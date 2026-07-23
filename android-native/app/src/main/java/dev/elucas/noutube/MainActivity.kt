package dev.elucas.noutube

import android.Manifest
import android.content.ComponentName
import android.content.pm.PackageManager
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.viewinterop.AndroidView
import androidx.core.content.ContextCompat
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import dev.elucas.noutube.download.DownloadRepository
import dev.elucas.noutube.player.PlaybackService
import dev.elucas.noutube.player.WebViewLink
import dev.elucas.noutube.ui.NouOverlay
import dev.elucas.noutube.webview.NouChromeClient
import dev.elucas.noutube.webview.NouWebView

class MainActivity : ComponentActivity() {

    private lateinit var webView: NouWebView
    private lateinit var chromeClient: NouChromeClient
    private var controllerFuture: ListenableFuture<MediaController>? = null

    private val requestNotifications =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* best-effort */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = NouWebView(this)
        chromeClient = NouChromeClient(this, webView)
        webView.webChromeClient = chromeClient

        // Kotlin -> WebView command channel (transport buttons, notification).
        WebViewLink.commandSink = { js -> runOnUiThread { webView.evaluateJavascript(js, null) } }
        // Web "download" button -> yt-dlp format probe.
        WebViewLink.onDownloadRequest = { url -> DownloadRepository.requestFormats(url) }

        connectMediaController()
        maybeAskNotificationPermission()

        onBackPressedDispatcher.addCallback(this, object : androidx.activity.OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    chromeClient.isFullscreen() ->
                        webView.evaluateJavascript("document.exitFullscreen && document.exitFullscreen()", null)
                    webView.canGoBack() -> webView.goBack()
                    else -> finish()
                }
            }
        })

        setContent {
            val holder = remember { webView }
            Box(Modifier.fillMaxSize()) {
                AndroidView(
                    modifier = Modifier.fillMaxSize(),
                    factory = {
                        (holder.parent as? ViewGroup)?.removeView(holder)
                        holder
                    },
                )
                NouOverlay(
                    onHome = { webView.home() },
                    onMusic = { webView.music() },
                )
            }
        }

        webView.home()
    }

    private fun connectMediaController() {
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        controllerFuture = MediaController.Builder(this, token).buildAsync()
    }

    private fun maybeAskNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            requestNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onDestroy() {
        WebViewLink.commandSink = null
        WebViewLink.onDownloadRequest = null
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controllerFuture = null
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }
}
