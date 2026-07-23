package dev.elucas.noutube.player

import android.content.Context
import android.net.Uri
import android.os.Build
import android.provider.MediaStore
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

/**
 * Lists media the app has downloaded, straight from MediaStore Downloads/. Since
 * yt-dlp publishes finished files there (see YtDlp.publishToDownloads), this
 * survives app restarts — the in-memory download list does not.
 *
 * Only the app's own MediaStore contributions are guaranteed readable without a
 * storage permission, which is exactly what we want for the MVP library.
 */
object LibraryRepository {

    data class Item(
        val uri: Uri,
        val name: String,
        val mimeType: String,
        val durationMs: Long,
        val isAudio: Boolean,
    )

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _items = MutableStateFlow<List<Item>>(emptyList())
    val items: StateFlow<List<Item>> = _items

    fun refresh(context: Context) {
        scope.launch { _items.value = query(context.applicationContext) }
    }

    private fun query(context: Context): List<Item> {
        val collection = MediaStore.Downloads.EXTERNAL_CONTENT_URI
        val hasDuration = Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q
        val projection = buildList {
            add(MediaStore.Downloads._ID)
            add(MediaStore.Downloads.DISPLAY_NAME)
            add(MediaStore.Downloads.MIME_TYPE)
            if (hasDuration) add(MediaStore.Downloads.DURATION)
        }.toTypedArray()

        val selection = "${MediaStore.Downloads.MIME_TYPE} LIKE ? OR ${MediaStore.Downloads.MIME_TYPE} LIKE ?"
        val args = arrayOf("video/%", "audio/%")
        val sort = "${MediaStore.Downloads.DATE_ADDED} DESC"

        val out = ArrayList<Item>()
        context.contentResolver.query(collection, projection, selection, args, sort)?.use { c ->
            val idCol = c.getColumnIndexOrThrow(MediaStore.Downloads._ID)
            val nameCol = c.getColumnIndexOrThrow(MediaStore.Downloads.DISPLAY_NAME)
            val mimeCol = c.getColumnIndexOrThrow(MediaStore.Downloads.MIME_TYPE)
            val durCol = if (hasDuration) c.getColumnIndex(MediaStore.Downloads.DURATION) else -1
            while (c.moveToNext()) {
                val id = c.getLong(idCol)
                val mime = c.getString(mimeCol).orEmpty()
                out.add(
                    Item(
                        uri = Uri.withAppendedPath(collection, id.toString()),
                        name = c.getString(nameCol).orEmpty(),
                        mimeType = mime,
                        durationMs = if (durCol >= 0 && !c.isNull(durCol)) c.getLong(durCol) else 0L,
                        isAudio = mime.startsWith("audio/"),
                    ),
                )
            }
        }
        return out
    }
}
