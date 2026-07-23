package dev.elucas.noutube

import android.app.Application
import dev.elucas.noutube.download.DownloadRepository

class NouApp : Application() {
    override fun onCreate() {
        super.onCreate()
        DownloadRepository.init(this)
    }
}
