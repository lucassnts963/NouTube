import { Modal, Pressable, View } from 'react-native'
import { useRef } from 'react'
import { SafeAreaView } from 'react-native-safe-area-context'
import { useEvent } from 'expo'
import { VideoView, useVideoPlayer } from 'expo-video'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { useValue } from '@legendapp/state/react'
import { NouText } from '../NouText'
import { RetryImage } from '../image/RetryImage'
import { player$ } from '@/states/player'
import type { LocalMedia } from '@/states/local-library'

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

const PlayerView: React.FC<{ media: LocalMedia }> = ({ media }) => {
  const isAudio = media.kind === 'audio'
  const videoRef = useRef<VideoView>(null)

  const player = useVideoPlayer(
    { uri: media.uri, metadata: { title: media.title, artist: 'GuriTube' } },
    (p) => {
      // Keep playing when the app is backgrounded and surface the media
      // notification / lock-screen controls.
      p.staysActiveInBackground = true
      p.showNowPlayingNotification = true
      p.loop = false
      p.play()
    },
  )

  const { isPlaying } = useEvent(player, 'playingChange', { isPlaying: player.playing })

  const close = () => player$.close()

  return (
    <Modal visible transparent={false} animationType="slide" onRequestClose={close}>
      <View className="flex-1 bg-black">
        <SafeAreaView edges={['top', 'bottom']} className="flex-1">
          <View className="flex-row items-center gap-3 px-3 py-2">
            <Pressable onPress={close} className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10">
              <MaterialIcons name="keyboard-arrow-down" size={28} color="#fff" />
            </Pressable>
            <NouText className="flex-1 text-white font-semibold" numberOfLines={1}>
              {media.title}
            </NouText>
            {!isAudio && (
              <Pressable
                onPress={() => videoRef.current?.startPictureInPicture()}
                className="h-10 w-10 items-center justify-center rounded-full active:bg-white/10"
              >
                <MaterialIcons name="picture-in-picture-alt" size={22} color="#fff" />
              </Pressable>
            )}
          </View>

          {isAudio ? (
            <View className="flex-1 items-center justify-center px-8">
              {media.thumbnail ? (
                <RetryImage
                  source={media.thumbnail}
                  contentFit="cover"
                  placeholder={{ blurhash }}
                  style={{ width: 280, height: 280, borderRadius: 16 }}
                />
              ) : (
                <View className="h-[280px] w-[280px] items-center justify-center rounded-2xl bg-zinc-800">
                  <MaterialIcons name="music-note" size={80} color="#71717a" />
                </View>
              )}
              <NouText className="mt-8 text-center text-white text-lg font-semibold" numberOfLines={2}>
                {media.title}
              </NouText>

              <View className="mt-8 flex-row items-center gap-8">
                <Pressable onPress={() => player.seekBy(-15)} className="h-14 w-14 items-center justify-center">
                  <MaterialIcons name="replay-10" size={40} color="#fff" />
                </Pressable>
                <Pressable
                  onPress={() => (isPlaying ? player.pause() : player.play())}
                  className="h-20 w-20 items-center justify-center rounded-full bg-white"
                >
                  <MaterialIcons name={isPlaying ? 'pause' : 'play-arrow'} size={48} color="#000" />
                </Pressable>
                <Pressable onPress={() => player.seekBy(15)} className="h-14 w-14 items-center justify-center">
                  <MaterialIcons name="forward-10" size={40} color="#fff" />
                </Pressable>
              </View>
            </View>
          ) : (
            <VideoView
              ref={videoRef}
              player={player}
              style={{ flex: 1 }}
              contentFit="contain"
              allowsPictureInPicture
              startsPictureInPictureAutomatically
              nativeControls
            />
          )}
        </SafeAreaView>
      </View>
    </Modal>
  )
}

export const MediaPlayerModal = () => {
  const media = useValue(player$.current)
  if (!media) return null
  // Remount when the selected media changes so a fresh player is created.
  return <PlayerView key={media.id} media={media} />
}
