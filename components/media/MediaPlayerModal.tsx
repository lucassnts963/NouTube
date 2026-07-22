import { Pressable, View } from 'react-native'
import { useValue } from '@legendapp/state/react'
import { t } from 'i18next'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import { player$ } from '@/states/player'
import { mainClient } from '@/lib/main-client'

// Web/desktop fallback: the built-in expo-video player is native-only, so here
// we surface the item and let the user open it with the system player.
export const MediaPlayerModal = () => {
  const media = useValue(player$.current)
  if (!media) return null

  const close = () => player$.close()

  return (
    <View className="absolute inset-0 z-20 items-center justify-center bg-black/80 px-6">
      <View className="w-full max-w-md rounded-2xl bg-white dark:bg-zinc-900 p-6 gap-4">
        <View className="flex-row items-center justify-between">
          <NouText className="flex-1 text-lg font-semibold" numberOfLines={2}>
            {media.title}
          </NouText>
          <Pressable onPress={close} className="h-9 w-9 items-center justify-center rounded-full active:bg-zinc-200 dark:active:bg-zinc-800">
            <MaterialIcons name="close" size={22} color="#a1a1aa" />
          </Pressable>
        </View>
        <NouButton
          onPress={() => {
            void mainClient.openFolder(media.uri)
            close()
          }}
        >
          {t('localLibrary.openExternally', 'Open with system player')}
        </NouButton>
      </View>
    </View>
  )
}
