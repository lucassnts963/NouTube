package dev.elucas.noutube.player

/**
 * Tiny JS -> Kotlin bridge. In this architecture the WebView is only a browse +
 * download surface, so the only thing it reports is "the user asked to download
 * this URL". Playback is owned entirely by the native ExoPlayer.
 */
object WebViewBridge {

    /** Set by the Activity; invoked when the web download button is tapped. */
    @Volatile
    var onDownloadRequest: ((String) -> Unit)? = null

    fun requestDownload(url: String) {
        onDownloadRequest?.invoke(url)
    }
}
