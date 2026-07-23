package dev.elucas.noutube

import android.Manifest
import android.content.ComponentName
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Build
import android.os.Bundle
import android.view.ViewGroup
import androidx.activity.ComponentActivity
import androidx.activity.OnBackPressedCallback
import androidx.activity.compose.setContent
import androidx.activity.result.contract.ActivityResultContracts
import androidx.compose.runtime.State
import androidx.compose.runtime.mutableStateOf
import androidx.core.content.ContextCompat
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.session.MediaController
import androidx.media3.session.SessionToken
import com.google.common.util.concurrent.ListenableFuture
import dev.elucas.noutube.download.DownloadRepository
import dev.elucas.noutube.player.LibraryRepository
import dev.elucas.noutube.player.PlaybackService
import dev.elucas.noutube.player.WebViewBridge
import dev.elucas.noutube.ui.MainScreen
import dev.elucas.noutube.webview.NouChromeClient
import dev.elucas.noutube.webview.NouWebView

class MainActivity : ComponentActivity() {

    private lateinit var webView: NouWebView
    private lateinit var chromeClient: NouChromeClient

    private var controllerFuture: ListenableFuture<MediaController>? = null
    private val playerState = mutableStateOf<Player?>(null)

    private val requestNotifications =
        registerForActivityResult(ActivityResultContracts.RequestPermission()) { /* best-effort */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        webView = NouWebView(this)
        chromeClient = NouChromeClient(this, webView)
        webView.webChromeClient = chromeClient

        // Web "download" button -> yt-dlp format probe.
        WebViewBridge.onDownloadRequest = { url -> DownloadRepository.requestFormats(url) }

        maybeAskNotificationPermission()
        connectController()

        onBackPressedDispatcher.addCallback(this, object : OnBackPressedCallback(true) {
            override fun handleOnBackPressed() {
                when {
                    chromeClient.isFullscreen() ->
                        webView.evaluateJavascript("document.exitFullscreen && document.exitFullscreen()", null)
                    webView.canGoBack() -> webView.goBack()
                    else -> finish()
                }
            }
        })

        val player: State<Player?> = playerState
        setContent {
            MainScreen(
                player = player.value,
                onPlay = ::playMedia,
                onUpdateYtDlp = { DownloadRepository.updateYtDlp { /* toast could go here */ } },
                onRefreshLibrary = { LibraryRepository.refresh(this) },
                webView = webView,
            )
        }

        webView.home()
        LibraryRepository.refresh(this)
    }

    private fun playMedia(uri: Uri) {
        val controller = playerState.value ?: return
        controller.setMediaItem(MediaItem.fromUri(uri))
        controller.prepare()
        controller.play()
    }

    private fun connectController() {
        val token = SessionToken(this, ComponentName(this, PlaybackService::class.java))
        val future = MediaController.Builder(this, token).buildAsync()
        controllerFuture = future
        future.addListener(
            { playerState.value = runCatching { future.get() }.getOrNull() },
            ContextCompat.getMainExecutor(this),
        )
    }

    private fun maybeAskNotificationPermission() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.TIRAMISU &&
            ContextCompat.checkSelfPermission(this, Manifest.permission.POST_NOTIFICATIONS) !=
            PackageManager.PERMISSION_GRANTED
        ) {
            requestNotifications.launch(Manifest.permission.POST_NOTIFICATIONS)
        }
    }

    override fun onResume() {
        super.onResume()
        LibraryRepository.refresh(this)
    }

    override fun onDestroy() {
        WebViewBridge.onDownloadRequest = null
        controllerFuture?.let { MediaController.releaseFuture(it) }
        controllerFuture = null
        (webView.parent as? ViewGroup)?.removeView(webView)
        webView.destroy()
        super.onDestroy()
    }
}
