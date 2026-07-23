package dev.elucas.noutube.webview

import android.app.Activity
import android.content.pm.ActivityInfo
import android.graphics.Bitmap
import android.graphics.Color
import android.provider.Settings
import android.view.View
import android.view.ViewGroup
import android.webkit.WebChromeClient
import android.widget.FrameLayout
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat

/**
 * Handles the YouTube web player's fullscreen requests: mounts the video view
 * over the whole window, hides system bars, and drives device orientation.
 *
 * Ported from the RN app's NouTubeView fullscreen logic, including the fix that
 * avoids a portrait/landscape fullscreen loop for vertical videos.
 */
class NouChromeClient(
    private val activity: Activity,
    private val webView: NouWebView,
) : WebChromeClient() {

    private var customView: View? = null

    override fun getDefaultVideoPoster(): Bitmap =
        Bitmap.createBitmap(intArrayOf(Color.BLACK), 1, 1, Bitmap.Config.ARGB_8888)

    override fun onShowCustomView(view: View, callback: CustomViewCallback) {
        if (customView != null) {
            onHideCustomView()
            return
        }
        customView = view
        view.keepScreenOn = true
        (activity.window.decorView as FrameLayout).addView(
            view,
            FrameLayout.LayoutParams(
                ViewGroup.LayoutParams.MATCH_PARENT,
                ViewGroup.LayoutParams.MATCH_PARENT,
            ),
        )

        // Do not force portrait videos back to portrait when the device rotates —
        // that fights the web player's orientation-driven fullscreen and loops.
        webView.evaluateJavascript(
            "(() => { const v = document.querySelector('#movie_player video') || " +
                "document.querySelector('video'); return !!v && v.videoHeight > v.videoWidth })()",
        ) { isPortrait ->
            if (customView !== view) return@evaluateJavascript
            activity.requestedOrientation =
                if (isPortrait == "true") ActivityInfo.SCREEN_ORIENTATION_USER
                else ActivityInfo.SCREEN_ORIENTATION_SENSOR_LANDSCAPE
        }

        val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
        controller.hide(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior =
            WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
    }

    override fun onHideCustomView() {
        val view = customView ?: return
        (activity.window.decorView as FrameLayout).removeView(view)
        view.keepScreenOn = false
        customView = null
        activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_USER

        val controller = WindowCompat.getInsetsController(activity.window, activity.window.decorView)
        controller.show(WindowInsetsCompat.Type.systemBars())
        controller.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_DEFAULT
    }

    fun isFullscreen(): Boolean = customView != null

    @Suppress("unused")
    private fun autoRotateEnabled(): Boolean =
        Settings.System.getInt(activity.contentResolver, Settings.System.ACCELEROMETER_ROTATION, 0) == 1
}
