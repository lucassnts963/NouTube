package dev.elucas.noutube.player

import android.net.Uri
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MediaMetadata
import androidx.media3.common.Player
import androidx.media3.common.SimpleBasePlayer
import androidx.media3.common.util.UnstableApi
import com.google.common.util.concurrent.Futures
import com.google.common.util.concurrent.ListenableFuture

/**
 * A Media3 [Player] whose "playback" is actually YouTube's web player inside the
 * WebView. This is the correct Media3 way to expose a non-ExoPlayer source: we
 * implement [SimpleBasePlayer], forward transport commands to [WebViewLink]
 * (which runs JS), and build [getState] from the state the injected script
 * reports back.
 *
 * Trick: YouTube handles the actual "next/previous video" logic, so we don't own
 * a real playlist. But Media3's notification "next/prev" buttons only fire when
 * the timeline HAS a next/previous item. We therefore expose a 3-item phantom
 * playlist (prev · current · next) with the cursor pinned to the middle. A button
 * press routes through [handleSeek] with COMMAND_SEEK_TO_NEXT/PREVIOUS, which we
 * translate into `NouTube.next()` / `NouTube.prev()`; [getState] always returns
 * the cursor at index 1, so the phantom neighbours never actually "play".
 */
@UnstableApi
class WebViewPlayer : SimpleBasePlayer(Looper.getMainLooper()) {

    private val mainHandler = Handler(Looper.getMainLooper())

    private val availableCommands = Player.Commands.Builder()
        .addAll(
            Player.COMMAND_PLAY_PAUSE,
            Player.COMMAND_PREPARE,
            Player.COMMAND_SEEK_TO_NEXT,
            Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
            Player.COMMAND_SEEK_TO_PREVIOUS,
            Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
            Player.COMMAND_SEEK_BACK,
            Player.COMMAND_SEEK_FORWARD,
            Player.COMMAND_SEEK_IN_CURRENT_MEDIA_ITEM,
            Player.COMMAND_GET_CURRENT_MEDIA_ITEM,
            Player.COMMAND_GET_METADATA,
            Player.COMMAND_GET_TIMELINE,
        )
        .build()

    init {
        // JS state arrives on a binder thread; invalidateState() must run on the
        // application looper (main).
        WebViewLink.onStateChanged = { mainHandler.post { invalidateState() } }
    }

    override fun getState(): State {
        val s = WebViewLink.state.value

        val metadata = MediaMetadata.Builder()
            .setTitle(s.title)
            .setArtist(s.artist)
            .apply { if (s.artworkUrl.isNotBlank()) setArtworkUri(Uri.parse(s.artworkUrl)) }
            .build()
        val durationUs = if (s.durationMs > 0) s.durationMs * 1000 else C.TIME_UNSET

        fun item(id: String, current: Boolean): MediaItemData =
            MediaItemData.Builder(id)
                .setMediaItem(MediaItem.Builder().setMediaId(id).build())
                .apply {
                    if (current) {
                        setMediaMetadata(metadata)
                        setDurationUs(durationUs)
                    }
                }
                .build()

        val playlist = listOf(
            item("nou-prev", current = false),
            item("nou-current", current = true),
            item("nou-next", current = false),
        )

        return State.Builder()
            .setAvailableCommands(availableCommands)
            .setPlaybackState(if (s.hasMedia) Player.STATE_READY else Player.STATE_IDLE)
            .setPlayWhenReady(s.isPlaying, Player.PLAY_WHEN_READY_CHANGE_REASON_USER_REQUEST)
            .setPlaylist(playlist)
            .setCurrentMediaItemIndex(1)
            .setContentPositionMs(s.positionMs)
            // Always go to the previous *video*, never "restart current", regardless of position.
            .setMaxSeekToPreviousPositionMs(Long.MAX_VALUE)
            .build()
    }

    override fun handleSetPlayWhenReady(playWhenReady: Boolean): ListenableFuture<*> {
        if (playWhenReady) WebViewLink.play() else WebViewLink.pause()
        return Futures.immediateVoidFuture()
    }

    override fun handleSeek(
        mediaItemIndex: Int,
        positionMs: Long,
        @Player.Command seekCommand: Int,
    ): ListenableFuture<*> {
        when (seekCommand) {
            Player.COMMAND_SEEK_TO_NEXT,
            Player.COMMAND_SEEK_TO_NEXT_MEDIA_ITEM,
            -> WebViewLink.next()

            Player.COMMAND_SEEK_TO_PREVIOUS,
            Player.COMMAND_SEEK_TO_PREVIOUS_MEDIA_ITEM,
            -> WebViewLink.previous()

            Player.COMMAND_SEEK_BACK -> WebViewLink.seekBy(-10)
            Player.COMMAND_SEEK_FORWARD -> WebViewLink.seekBy(30)
            else -> if (positionMs >= 0) WebViewLink.seekTo((positionMs / 1000).toInt())
        }
        return Futures.immediateVoidFuture()
    }

    override fun handlePrepare(): ListenableFuture<*> = Futures.immediateVoidFuture()

    override fun handleRelease(): ListenableFuture<*> {
        WebViewLink.onStateChanged = null
        return Futures.immediateVoidFuture()
    }
}
