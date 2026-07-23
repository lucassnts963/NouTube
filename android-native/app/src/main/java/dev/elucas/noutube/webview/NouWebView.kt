package dev.elucas.noutube.webview

import android.annotation.SuppressLint
import android.content.Context
import android.content.Intent
import android.graphics.Bitmap
import android.net.Uri
import android.webkit.CookieManager
import android.webkit.WebResourceRequest
import android.webkit.WebResourceResponse
import android.webkit.WebView
import android.webkit.WebViewClient
import android.widget.Toast
import java.io.ByteArrayInputStream

/** Ad/telemetry hosts blocked at the network layer (empty response). */
private val BLOCK_HOSTS = setOf(
    "www.googletagmanager.com",
    "googleads.g.doubleclick.net",
)

/** Hosts kept inside the WebView; anything else opens in the external browser. */
private fun isInternal(host: String?): Boolean {
    if (host == null) return false
    return host.endsWith("youtube.com") ||
        host == "youtu.be" ||
        host.startsWith("accounts.google.") ||
        host.startsWith("gds.google.")
}

/**
 * The wrapper WebView. Configured to render YouTube's mobile site and to inject
 * [ScriptInjector]'s content script on every page start.
 */
@SuppressLint("SetJavaScriptEnabled")
class NouWebView(context: Context) : WebView(context) {

    /** Notified whenever the (SPA) URL changes, so the UI can react. */
    var onUrlChanged: ((String) -> Unit)? = null

    private var lastUrl = ""

    init {
        settings.apply {
            javaScriptEnabled = true
            domStorageEnabled = true
            mediaPlaybackRequiresUserGesture = false
            builtInZoomControls = true
            displayZoomControls = false
            // Force the mobile layout; keeps YouTube's lightweight web player.
            userAgentString =
                "Mozilla/5.0 (Linux; Android 13; Pixel 7) AppleWebKit/537.36 " +
                "(KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36"
        }
        CookieManager.getInstance().setAcceptCookie(true)
        CookieManager.getInstance().setAcceptThirdPartyCookies(this, true)

        isFocusable = true
        isFocusableInTouchMode = true

        addJavascriptInterface(NouJsInterface(), "NouTubeI")

        webViewClient = object : WebViewClient() {
            override fun onPageStarted(view: WebView, url: String, favicon: Bitmap?) {
                view.evaluateJavascript(ScriptInjector.script(context), null)
            }

            override fun doUpdateVisitedHistory(view: WebView, url: String, isReload: Boolean) {
                if (url != lastUrl) {
                    lastUrl = url
                    onUrlChanged?.invoke(url)
                }
            }

            override fun shouldInterceptRequest(
                view: WebView,
                request: WebResourceRequest,
            ): WebResourceResponse? {
                if (request.url.host in BLOCK_HOSTS) {
                    return WebResourceResponse(
                        "text/plain", "utf-8", ByteArrayInputStream(ByteArray(0)),
                    )
                }
                return null
            }

            override fun shouldOverrideUrlLoading(
                view: WebView,
                request: WebResourceRequest,
            ): Boolean {
                val uri = request.url
                if (isInternal(uri.host)) return false
                return try {
                    context.startActivity(Intent(Intent.ACTION_VIEW, uri))
                    true
                } catch (e: Exception) {
                    Toast.makeText(context, "No app found to open this link", Toast.LENGTH_SHORT).show()
                    true
                }
            }
        }
    }

    fun home() = loadUrl("https://m.youtube.com")
    fun music() = loadUrl("https://music.youtube.com")
}
