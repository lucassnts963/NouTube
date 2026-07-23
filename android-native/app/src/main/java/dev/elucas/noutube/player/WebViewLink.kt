package dev.elucas.noutube.player

import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.update

/**
 * Process-wide bridge between the WebView (which owns playback) and the Media3
 * session/player (which owns the notification and hardware controls).
 *
 * - Commands flow OUT: the [Media3 player][WebViewPlayer] and MediaSession call
 *   [play]/[pause]/[next]/[previous]/[seekBy], which run the matching JS on the
 *   WebView via [commandSink].
 * - State flows IN: [NouJsInterface] calls [onNotify]/[onProgress] with data the
 *   injected script scraped from YouTube's player, updating [state].
 *
 * A singleton because the Service and the Activity live in different lifecycles
 * but must share exactly one playback truth. Kept deliberately tiny.
 */
object WebViewLink {

    data class PlaybackState(
        val hasMedia: Boolean = false,
        val isPlaying: Boolean = false,
        val title: String = "",
        val artist: String = "",
        val artworkUrl: String = "",
        val durationMs: Long = 0L,
        val positionMs: Long = 0L,
    )

    private val _state = MutableStateFlow(PlaybackState())
    val state: StateFlow<PlaybackState> = _state

    /** Runs a JS snippet on the WebView. Set by the Activity; always invoked on main. */
    @Volatile
    var commandSink: ((String) -> Unit)? = null

    /** Invoked when the web UI requests a download for [url]. Set by the Activity. */
    @Volatile
    var onDownloadRequest: ((String) -> Unit)? = null

    /** Called when playback state meaningfully changes, so the session can refresh. */
    @Volatile
    var onStateChanged: (() -> Unit)? = null

    // --- commands OUT (Kotlin -> WebView) ---
    fun play() = run("NouTube.play()")
    fun pause() = run("NouTube.pause()")
    fun next() = run("NouTube.next()")
    fun previous() = run("NouTube.prev()")
    fun seekBy(deltaSeconds: Int) = run("NouTube.seekBy($deltaSeconds)")
    fun seekTo(positionSeconds: Int) = run("NouTube.seekTo($positionSeconds)")

    private fun run(js: String) {
        commandSink?.invoke(js)
    }

    // --- state IN (WebView -> Kotlin) ---
    fun onNotify(title: String, artist: String, durationSeconds: Long, artworkUrl: String) {
        _state.update {
            it.copy(
                hasMedia = true,
                title = title,
                artist = artist,
                durationMs = durationSeconds * 1000L,
                artworkUrl = artworkUrl,
            )
        }
        onStateChanged?.invoke()
    }

    fun onProgress(isPlaying: Boolean, positionSeconds: Long) {
        val prev = _state.value
        _state.update {
            it.copy(
                hasMedia = true,
                isPlaying = isPlaying,
                positionMs = positionSeconds * 1000L,
            )
        }
        // Only nudge the session when the play/pause flips or the video is playing;
        // per-second position ticks would otherwise rebuild the notification needlessly.
        if (prev.isPlaying != isPlaying || isPlaying) {
            onStateChanged?.invoke()
        }
    }

    fun requestDownload(url: String) {
        onDownloadRequest?.invoke(url)
    }
}
