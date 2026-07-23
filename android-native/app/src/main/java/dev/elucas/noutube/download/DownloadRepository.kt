package dev.elucas.noutube.download

import android.content.Context
import android.util.Log
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

/**
 * Orchestrates the download flow and exposes observable state to the Compose UI:
 *
 *  1. [requestFormats] (triggered by the web "download" button) probes yt-dlp and
 *     publishes a [FormatRequest]; the UI shows a picker.
 *  2. [pick] starts the actual download, streaming progress into [downloads].
 *  3. [updateYtDlp] refreshes the bundled yt-dlp.
 *
 * A singleton initialised in [NouApp]. All yt-dlp work runs on Dispatchers.IO.
 */
object DownloadRepository {

    enum class Status { PENDING, RUNNING, DONE, ERROR }

    data class Download(
        val url: String,
        val title: String = "",
        val progress: Float = 0f,
        val line: String = "",
        val status: Status = Status.PENDING,
        val savedUri: String? = null,
    )

    data class FormatRequest(
        val url: String,
        val title: String,
        val options: List<YtDlp.FormatOption>,
    )

    private lateinit var ytDlp: YtDlp
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    private val _downloads = MutableStateFlow<List<Download>>(emptyList())
    val downloads: StateFlow<List<Download>> = _downloads

    /** Non-null while the format picker should be shown. */
    private val _pendingRequest = MutableStateFlow<FormatRequest?>(null)
    val pendingRequest: StateFlow<FormatRequest?> = _pendingRequest

    /** True while [requestFormats] is probing (the picker shows a spinner). */
    private val _probing = MutableStateFlow<String?>(null)
    val probing: StateFlow<String?> = _probing

    private val _error = MutableStateFlow<String?>(null)
    val error: StateFlow<String?> = _error

    fun init(context: Context) {
        ytDlp = YtDlp(context.applicationContext)
    }

    fun requestFormats(url: String) {
        _probing.value = url
        _error.value = null
        scope.launch {
            runCatching { ytDlp.listFormats(url) }
                .onSuccess { _pendingRequest.value = FormatRequest(url, it.title, it.options) }
                .onFailure { _error.value = it.message ?: "Falha ao listar formatos" }
            _probing.value = null
        }
    }

    fun dismissRequest() {
        _pendingRequest.value = null
    }

    fun clearError() {
        _error.value = null
    }

    fun pick(option: YtDlp.FormatOption) {
        val request = _pendingRequest.value ?: return
        _pendingRequest.value = null
        val url = request.url
        upsert(Download(url = url, title = request.title, status = Status.PENDING))
        scope.launch {
            runCatching {
                ytDlp.downloadVideo(url, option.formatId) { progress, _, line ->
                    upsert(
                        current(url).copy(
                            progress = progress,
                            line = line ?: current(url).line,
                            status = Status.RUNNING,
                        ),
                    )
                }
            }.onSuccess { result ->
                upsert(current(url).copy(progress = 100f, status = Status.DONE, savedUri = result.savedUri))
            }.onFailure { e ->
                Log.e("DownloadRepository", "download failed", e)
                upsert(current(url).copy(status = Status.ERROR, line = e.message ?: "Erro no download"))
            }
        }
    }

    fun updateYtDlp(onDone: (Boolean) -> Unit) {
        scope.launch {
            val ok = runCatching { ytDlp.update() }.isSuccess
            onDone(ok)
        }
    }

    private fun current(url: String): Download =
        _downloads.value.firstOrNull { it.url == url } ?: Download(url = url)

    private fun upsert(item: Download) {
        _downloads.update { list ->
            val idx = list.indexOfFirst { it.url == item.url }
            if (idx >= 0) list.toMutableList().also { it[idx] = item }
            else list + item
        }
    }
}
