package dev.elucas.noutube.player

import androidx.media3.common.util.UnstableApi
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * Media3 service that hosts the [WebViewPlayer]-backed [MediaSession]. Media3's
 * default notification provider builds the media notification (artwork, title,
 * prev/play-pause/next) automatically from the player state — no manual
 * NotificationCompat wiring.
 *
 * The service is started/kept alive by the MediaController the Activity connects
 * (see MainActivity), and goes foreground on its own while playback is active.
 */
@UnstableApi
class PlaybackService : MediaSessionService() {

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val player = WebViewPlayer()
        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        mediaSession

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
        }
        mediaSession = null
        super.onDestroy()
    }
}
