package dev.elucas.noutube.webview

import android.webkit.JavascriptInterface
import dev.elucas.noutube.player.WebViewLink
import org.json.JSONObject

/**
 * JS -> Kotlin bridge, exposed to the page as `window.NouTubeI`.
 *
 * Mirrors the three entry points the injected script (assets/nou.js) calls.
 * Every method runs on a WebView JavaBridge thread (NOT the main thread), so it
 * only touches [WebViewLink], which is thread-safe.
 */
class NouJsInterface {

    /** Generic event channel: `{ "type": "...", "data": {...} }`. */
    @JavascriptInterface
    fun onMessage(payload: String) {
        val json = runCatching { JSONObject(payload) }.getOrNull() ?: return
        when (json.optString("type")) {
            "download" -> {
                val url = json.optJSONObject("data")?.optString("url").orEmpty()
                if (url.isNotBlank()) WebViewLink.requestDownload(url)
            }
        }
    }

    /** Fired when the active video changes. */
    @JavascriptInterface
    fun notify(title: String, author: String, seconds: Long, thumbnail: String) {
        WebViewLink.onNotify(title, author, seconds, thumbnail)
    }

    /** Fired roughly once per second while a video is loaded. */
    @JavascriptInterface
    fun notifyProgress(playing: Boolean, pos: Long) {
        WebViewLink.onProgress(playing, pos)
    }
}
