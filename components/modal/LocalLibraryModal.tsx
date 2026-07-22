import { FlatList, Pressable, View } from 'react-native'
import { useMemo, useState } from 'react'
import { useValue } from '@legendapp/state/react'
import { t } from 'i18next'
import MaterialIcons from '@react-native-vector-icons/material-icons'
import { NouText } from '../NouText'
import { BaseModal } from './BaseModal'
import { NouButton } from '../button/NouButton'
import { NouMenu } from '../menu/NouMenu'
import { MaterialButton } from '../button/IconButtons'
import { RetryImage } from '../image/RetryImage'
import { Segmented } from '../picker/Segmented'
import { ui$ } from '@/states/ui'
import { localLibrary$, type LocalMedia } from '@/states/local-library'
import { player$ } from '@/states/player'
import { clsx, isIos, isWeb } from '@/lib/utils'

const blurhash =
  '|rF?hV%2WCj[ayj[a|j[az_NaeWBj@ayfRayfQfQM{M|azj[azf6fQfQfQIpWXofj[ayj[j[fQayWCoeoeaya}j[ayfQa{oLj?j[WVj[ayayj[fQoff7azayj[ayj[j[ayofayayayj[fQj[ayayj[ayfjj[j[ayjuayj['

const LocalMediaItem: React.FC<{ media: LocalMedia }> = ({ media }) => {
  const isAudio = media.kind === 'audio'
  return (
    <View className="flex-row my-2 items-center overflow-hidden px-2">
      <Pressable className="w-[120px]" onPress={() => player$.open(media)}>
        {media.thumbnail ? (
          <RetryImage
            source={media.thumbnail}
            contentFit="cover"
            placeholder={{ blurhash }}
            style={{ height: 67.5, borderRadius: 8 }}
          />
        ) : (
          <View
            className="items-center justify-center rounded-lg bg-zinc-200 dark:bg-zinc-800"
            style={{ height: 67.5 }}
          >
            <MaterialIcons name={isAudio ? 'music-note' : 'movie'} size={28} color="#a1a1aa" />
          </View>
        )}
        <View className="absolute bottom-1 left-1 flex-row items-center gap-1 rounded bg-black/70 px-1.5 py-0.5">
          <MaterialIcons name={isAudio ? 'music-note' : 'movie'} size={12} color="#fff" />
          <NouText className="text-[10px] text-white">
            {isAudio ? t('localLibrary.audio', 'Audio') : t('localLibrary.video', 'Video')}
          </NouText>
        </View>
      </Pressable>
      <Pressable className="flex-1 ml-3" onPress={() => player$.open(media)}>
        <NouText className="leading-6" numberOfLines={3} ellipsizeMode="tail">
          {media.title}
        </NouText>
      </Pressable>
      <View>
        <NouMenu
          trigger={isWeb ? <MaterialButton name="more-vert" size={20} /> : isIos ? 'ellipsis' : 'filled.MoreVert'}
          items={[{ label: t('menus.remove', 'Remove'), handler: () => localLibrary$.removeMedia(media.id) }]}
        />
      </View>
    </View>
  )
}

export const LocalLibraryModal = () => {
  const open = useValue(ui$.localLibraryModalOpen)
  const items = useValue(localLibrary$.items)
  const [filterIndex, setFilterIndex] = useState(0)
  const filterKinds = ['all', 'audio', 'video'] as const
  const filter = filterKinds[filterIndex]

  const filtered = useMemo(() => {
    if (filter === 'all') return items
    return items.filter((x) => x.kind === filter)
  }, [items, filter])

  if (!open) return null

  return (
    <BaseModal onClose={() => ui$.localLibraryModalOpen.set(false)}>
      <View className="mt-3 mb-3 px-2 flex-row items-center justify-between">
        <NouText className="font-semibold text-lg">{t('localLibrary.title', 'Downloads')}</NouText>
        {items.length > 0 && (
          <NouButton variant="outline" size="1" onPress={() => localLibrary$.clear()}>
            {t('buttons.clearAll', 'Clear all')}
          </NouButton>
        )}
      </View>

      <View className="px-2 mb-2">
        <Segmented
          selectedIndex={filterIndex}
          onChange={setFilterIndex}
          options={[
            t('localLibrary.all', 'All'),
            t('localLibrary.music', 'Music'),
            t('localLibrary.videos', 'Videos'),
          ]}
        />
      </View>

      {filtered.length === 0 ? (
        <View className={clsx('flex-1 items-center justify-center px-6')}>
          <MaterialIcons name="library-music" size={40} color="#a1a1aa" />
          <NouText className="mt-3 text-center text-zinc-500 dark:text-zinc-400">
            {t('localLibrary.empty', 'Downloaded videos and music will show up here.')}
          </NouText>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => item.id}
          renderItem={({ item }) => <LocalMediaItem media={item} />}
        />
      )}
    </BaseModal>
  )
}
