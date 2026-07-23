package dev.elucas.noutube.webview

import android.webkit.JavascriptInterface
import dev.elucas.noutube.player.WebViewBridge
import org.json.JSONObject

/**
 * JS -> Kotlin bridge, exposed to the page as `window.NouTubeI`.
 * Only carries download requests; playback lives in the native player.
 */
class NouJsInterface {

    @JavascriptInterface
    fun onMessage(payload: String) {
        val json = runCatching { JSONObject(payload) }.getOrNull() ?: return
        if (json.optString("type") == "download") {
            val url = json.optJSONObject("data")?.optString("url").orEmpty()
            if (url.isNotBlank()) WebViewBridge.requestDownload(url)
        }
    }
}
