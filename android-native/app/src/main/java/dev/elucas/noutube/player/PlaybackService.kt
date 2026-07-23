package dev.elucas.noutube.player

import android.content.Intent
import androidx.media3.common.AudioAttributes
import androidx.media3.common.C
import androidx.media3.exoplayer.ExoPlayer
import androidx.media3.session.MediaSession
import androidx.media3.session.MediaSessionService

/**
 * The native player. A real Media3 [ExoPlayer] wrapped in a [MediaSession]:
 * plays downloaded local files now (and, later, resolved YouTube streams).
 *
 * Media3 gives us for free:
 *  - the media notification (artwork/title/prev-play-next) via the default provider,
 *  - background playback as a foreground service while playing,
 *  - audio focus handling and pause-on-headphone-unplug.
 *
 * The UI talks to this through a MediaController (see MainActivity), so the same
 * ExoPlayer instance drives both the on-screen PlayerView and the notification.
 */
class PlaybackService : MediaSessionService() {

    private var mediaSession: MediaSession? = null

    override fun onCreate() {
        super.onCreate()
        val player = ExoPlayer.Builder(this)
            .setAudioAttributes(
                AudioAttributes.Builder()
                    .setUsage(C.USAGE_MEDIA)
                    .setContentType(C.AUDIO_CONTENT_TYPE_MOVIE)
                    .build(),
                /* handleAudioFocus = */ true,
            )
            .setHandleAudioBecomingNoisy(true) // pause when headphones/BT disconnect
            .build()

        mediaSession = MediaSession.Builder(this, player).build()
    }

    override fun onGetSession(controllerInfo: MediaSession.ControllerInfo): MediaSession? =
        mediaSession

    override fun onTaskRemoved(rootIntent: Intent?) {
        val player = mediaSession?.player
        // If nothing is playing when the task is swiped away, don't linger.
        if (player == null || !player.playWhenReady || player.mediaItemCount == 0) {
            stopSelf()
        }
    }

    override fun onDestroy() {
        mediaSession?.run {
            player.release()
            release()
        }
        mediaSession = null
        super.onDestroy()
    }
}
