# yt-dlp / youtubedl-android ships a Python runtime and reflects into it; keep it.
-keep class com.yausername.** { *; }
-dontwarn com.yausername.**

# The JS bridge is invoked reflectively by the WebView from JavaScript.
-keepclassmembers class dev.elucas.noutube.webview.NouJsInterface {
    @android.webkit.JavascriptInterface <methods>;
}
