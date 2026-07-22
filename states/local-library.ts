import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { genId, isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'
import type { MediaKind } from './downloads'

export interface LocalMedia {
  id: string
  /** Playable uri of the downloaded file (content:// on Android, path elsewhere). */
  uri: string
  title: string
  kind: MediaKind
  thumbnail?: string
  /** Original YouTube url, when known. */
  sourceUrl?: string
  addedAt: number
}

interface Store {
  items: LocalMedia[]
  addMedia: (media: Omit<LocalMedia, 'id' | 'addedAt'> & Partial<Pick<LocalMedia, 'id' | 'addedAt'>>) => void
  removeMedia: (id: string) => void
  clear: () => void
}

export const localLibrary$ = observable<Store>({
  items: [],
  addMedia: (media) => {
    if (!media.uri) return
    // Dedupe by uri: a re-download of the same file just updates metadata.
    const existing = localLibrary$.items.get().find((x) => x.uri === media.uri)
    if (existing) {
      localLibrary$.items.set((items) =>
        items.map((x) => (x.uri === media.uri ? { ...x, ...media, id: x.id } : x)),
      )
      return
    }
    localLibrary$.items.unshift({
      id: media.id || genId(),
      addedAt: media.addedAt || Date.now(),
      thumbnail: media.thumbnail,
      sourceUrl: media.sourceUrl,
      ...media,
    } as LocalMedia)
  },
  removeMedia: (id) => {
    localLibrary$.items.set(localLibrary$.items.get().filter((x) => x.id !== id))
  },
  clear: () => {
    localLibrary$.items.set([])
  },
})

if (isWeb) {
  syncObservable(localLibrary$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'localLibrary',
      },
    },
  })
} else {
  syncObservable(localLibrary$, {
    persist: {
      name: 'localLibrary',
      plugin: ObservablePersistMMKV,
    },
  })
}
