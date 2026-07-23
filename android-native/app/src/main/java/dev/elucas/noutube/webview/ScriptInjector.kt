package dev.elucas.noutube.webview

import android.content.Context

/**
 * Loads the injected content script (assets/nou.js) once and caches it.
 *
 * A short prelude sets `window.isAndroid = true` before the bundle runs, matching
 * how the RN app fed feature flags in. Injected on every page start.
 */
object ScriptInjector {
    private const val ASSET = "nou.js"

    @Volatile
    private var cached: String? = null

    fun script(context: Context): String {
        cached?.let { return it }
        val body = context.assets.open(ASSET).bufferedReader().use { it.readText() }
        val full = "window.isAndroid = true;\n$body"
        cached = full
        return full
    }
}
