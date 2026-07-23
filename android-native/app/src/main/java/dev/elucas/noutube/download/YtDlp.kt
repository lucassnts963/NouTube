package dev.elucas.noutube.download

import android.content.ContentValues
import android.content.Context
import android.os.Environment
import android.provider.MediaStore
import android.util.Log
import android.webkit.MimeTypeMap
import com.yausername.ffmpeg.FFmpeg
import com.yausername.youtubedl_android.YoutubeDL
import com.yausername.youtubedl_android.YoutubeDLRequest
import org.json.JSONObject
import java.io.File

/**
 * Thin wrapper over youtubedl-android (bundled Python + yt-dlp + ffmpeg).
 * Ported from the RN app's NouYtDlp.kt with the i18n/event glue removed.
 *
 * Init is heavy (extracts the runtime to disk) so it is lazy and must run off
 * the main thread — always call these from Dispatchers.IO.
 */
class YtDlp(private val context: Context) {

    data class FormatOption(val formatId: String, val label: String, val description: String)
    data class Formats(val title: String, val options: List<FormatOption>)
    data class DownloadResult(val savedUri: String, val lastLine: String)

    companion object {
        private const val TAG = "YtDlp"
        private val lock = Any()

        @Volatile private var ytInit = false
        @Volatile private var ffmpegInit = false
    }

    private fun ensureYoutubeDL() {
        if (ytInit) return
        synchronized(lock) {
            if (ytInit) return
            YoutubeDL.getInstance().init(context)
            ytInit = true
        }
    }

    private fun ensureFFmpeg() {
        if (ffmpegInit) return
        synchronized(lock) {
            if (ffmpegInit) return
            FFmpeg.getInstance().init(context)
            ffmpegInit = true
        }
    }

    /** Probe the video and return a small, curated set of download choices. */
    fun listFormats(url: String): Formats {
        ensureYoutubeDL()

        val request = YoutubeDLRequest(url).apply {
            addOption("--dump-json")
            addOption("--no-playlist")
            addOption("-R", "1")
            addOption("--socket-timeout", "5")
        }
        val response = YoutubeDL.getInstance().execute(request)
        val json = JSONObject(response.out ?: error("yt-dlp returned empty output"))

        val formatsArray = json.optJSONArray("formats")
        val formats = (0 until (formatsArray?.length() ?: 0)).mapNotNull { formatsArray?.optJSONObject(it) }
        val videoFormats = formats.filter { it.optString("vcodec") != "none" && it.optInt("height") > 0 }
        val maxHeight = videoFormats.maxOfOrNull { it.optInt("height") } ?: 0

        val options = buildList {
            if (maxHeight > 1080) {
                add(FormatOption("bestvideo+bestaudio/best", "Melhor qualidade", "Até ${maxHeight}p"))
            }
            if (videoFormats.any { it.optInt("height") == 1080 }) {
                add(FormatOption("bestvideo[height<=1080]+bestaudio/best[height<=1080]", "1080p", "Full HD"))
            }
            if (videoFormats.any { it.optInt("height") == 720 }) {
                add(FormatOption("bestvideo[height<=720]+bestaudio/best[height<=720]", "720p", "HD"))
            }
            val audio = formats.filter { it.optString("vcodec") == "none" && it.optString("acodec") != "none" }
            if (audio.isNotEmpty()) {
                add(FormatOption("bestaudio/best", "Áudio", "Só a faixa de áudio"))
                add(FormatOption("bestaudio-mp3", "Áudio (MP3)", "Converte para MP3 com capa"))
            }
        }

        return Formats(json.optString("title"), options)
    }

    /** Download to a temp dir, then publish into MediaStore Downloads/. */
    fun downloadVideo(
        url: String,
        formatId: String,
        onProgress: (progress: Float, etaSeconds: Long, line: String?) -> Unit,
    ): DownloadResult {
        ensureYoutubeDL()
        ensureFFmpeg()

        val tempDir = File(context.cacheDir, "yt-dlp-${System.currentTimeMillis()}").apply { mkdirs() }
        val isMp3 = formatId == "bestaudio-mp3"
        val request = YoutubeDLRequest(url).apply {
            addOption("-f", if (isMp3) "bestaudio/best" else formatId)
            addOption("-o", "${tempDir.absolutePath}/%(title)s.%(ext)s")
            addOption("--no-playlist")
            if (isMp3) {
                addOption("--extract-audio")
                addOption("--audio-format", "mp3")
                addOption("--add-metadata")
                addOption("--embed-thumbnail")
            } else {
                addOption("--merge-output-format", "mp4")
            }
        }

        var lastLine = ""
        try {
            YoutubeDL.getInstance().execute(request) { progress, eta, line ->
                lastLine = line ?: lastLine
                onProgress(progress, eta, line)
            }
            val outputFile = tempDir.listFiles()?.filter { it.isFile }?.maxByOrNull { it.lastModified() }
                ?: error("Download finished but produced no file")
            val savedUri = publishToDownloads(outputFile)
            return DownloadResult(savedUri, lastLine)
        } finally {
            tempDir.deleteRecursively()
        }
    }

    /**
     * Update the bundled yt-dlp (YouTube breaks it regularly). The library's
     * update signature has drifted across versions (context-only, context+channel,
     * channel-only), so resolve it reflectively — same tactic as the RN app.
     */
    fun update() {
        ensureYoutubeDL()
        val yt = YoutubeDL.getInstance()
        val channel = runCatching { resolveStableChannel() }.getOrNull()
        val methods = YoutubeDL::class.java.methods.filter {
            it.name == "updateYoutubeDL" || it.name == "updateYoutubeDl"
        }

        fun tryInvoke(): Boolean {
            // context + channel
            if (channel != null) {
                methods.firstOrNull { m ->
                    m.parameterTypes.size == 2 &&
                        m.parameterTypes[0].isAssignableFrom(Context::class.java) &&
                        m.parameterTypes[1].isAssignableFrom(channel.javaClass)
                }?.let { it.invoke(yt, context, channel); return true }
                // channel only
                methods.firstOrNull { m ->
                    m.parameterTypes.size == 1 && m.parameterTypes[0].isAssignableFrom(channel.javaClass)
                }?.let { it.invoke(yt, channel); return true }
            }
            // context only
            methods.firstOrNull { m ->
                m.parameterTypes.size == 1 && m.parameterTypes[0].isAssignableFrom(Context::class.java)
            }?.let { it.invoke(yt, context); return true }
            // no-arg
            methods.firstOrNull { it.parameterTypes.isEmpty() }?.let { it.invoke(yt); return true }
            return false
        }

        runCatching { if (!tryInvoke()) error("updateYoutubeDL method not found") }
            .onFailure { Log.w(TAG, "updateYoutubeDL failed", it) }
    }

    private fun resolveStableChannel(): Any? {
        val classNames = listOf(
            "com.yausername.youtubedl_android.YoutubeDL\$UpdateChannel",
            "com.yausername.youtubedl_android.UpdateChannel",
        )
        for (name in classNames) {
            val clazz = runCatching { Class.forName(name) }.getOrNull() ?: continue
            runCatching { return clazz.getField("_STABLE").get(null) }
            runCatching { return clazz.getField("STABLE").get(null) }
            if (clazz.isEnum) {
                (clazz.enumConstants as? Array<*>)
                    ?.firstOrNull { (it as? Enum<*>)?.name == "STABLE" }
                    ?.let { return it }
            }
        }
        return null
    }

    private fun publishToDownloads(source: File): String {
        val ext = source.extension.lowercase()
        val mime = MimeTypeMap.getSingleton().getMimeTypeFromExtension(ext).orEmpty()
        val values = ContentValues().apply {
            put(MediaStore.Downloads.DISPLAY_NAME, source.name)
            if (mime.isNotBlank()) put(MediaStore.Downloads.MIME_TYPE, mime)
            put(MediaStore.Downloads.RELATIVE_PATH, Environment.DIRECTORY_DOWNLOADS)
            put(MediaStore.Downloads.IS_PENDING, 1)
        }
        val resolver = context.contentResolver
        val uri = resolver.insert(MediaStore.Downloads.EXTERNAL_CONTENT_URI, values)
            ?: error("Failed to create MediaStore entry")
        try {
            resolver.openOutputStream(uri)?.use { out ->
                source.inputStream().use { it.copyTo(out) }
            } ?: error("Failed to open MediaStore stream")
            values.clear()
            values.put(MediaStore.Downloads.IS_PENDING, 0)
            resolver.update(uri, values, null, null)
            return uri.toString()
        } catch (e: Exception) {
            resolver.delete(uri, null, null)
            throw e
        }
    }
}
