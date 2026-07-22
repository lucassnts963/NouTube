import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { genId, isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'

const LIMIT = 1000

export interface History {
  id: string
  videoId: string
  url: string
  title: string
  thumbnail?: string
  duration: number
  current: number
  updatedAt: number
}

interface Store {
  bookmarks: History[]
  urls: () => Set<string>
  size: () => number
  removeHistory: (history: History) => void
  addHistory: (history: Partial<History>) => void
  importHistory: (items: Partial<History>[]) => number
}

export const history$ = observable<Store>({
  bookmarks: [],
  urls: (): Set<string> => {
    return new Set(history$.bookmarks.get().map((x) => x.url))
  },
  size: (): number => {
    return history$.urls.size
  },
  removeHistory: (history) => {
    const filtered = history$.bookmarks.get().filter((x) => x.id != history.id)
    history$.bookmarks.set(filtered)
  },
  addHistory: (history) => {
    const latest = history$.bookmarks[0].get()
    if (latest && latest.videoId == history.videoId) {
      history$.bookmarks[0].assign({
        ...history,
        updatedAt: Date.now(),
      })
    } else {
      history$.bookmarks.unshift({
        id: genId(),
        videoId: '',
        url: '',
        title: '',
        duration: 0,
        current: 0,
        ...history,
        updatedAt: Date.now(),
      } as History)
    }

    if (history$.bookmarks.length > LIMIT) {
      history$.bookmarks.splice(LIMIT, history$.bookmarks.length)
    }
  },
  // Bulk import (e.g. from a YouTube Takeout watch-history export). Entries are
  // merged with the existing history, deduped by videoId (keeping the most
  // recent timestamp), sorted newest-first and capped at LIMIT.
  importHistory: (items) => {
    const byKey = new Map<string, History>()
    for (const h of history$.bookmarks.get()) {
      const key = h.videoId || h.url
      if (key) byKey.set(key, h)
    }

    let added = 0
    for (const item of items) {
      const videoId = item.videoId || ''
      const key = videoId || item.url || ''
      if (!key) continue

      const prev = byKey.get(key)
      if (prev) {
        const updatedAt = item.updatedAt || 0
        if (updatedAt > prev.updatedAt) {
          byKey.set(key, { ...prev, ...item, id: prev.id, updatedAt })
        }
        continue
      }

      byKey.set(key, {
        id: genId(),
        videoId,
        url: item.url || '',
        title: item.title || '',
        thumbnail: item.thumbnail,
        duration: 0,
        current: 0,
        ...item,
        updatedAt: item.updatedAt || Date.now(),
      } as History)
      added += 1
    }

    const merged = [...byKey.values()].sort((a, b) => b.updatedAt - a.updatedAt)
    if (merged.length > LIMIT) merged.length = LIMIT
    history$.bookmarks.set(merged)
    return added
  },
})

if (isWeb) {
  syncObservable(history$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'history',
      },
    },
  })
} else {
  syncObservable(history$, {
    persist: {
      name: 'history',
      plugin: ObservablePersistMMKV,
    },
  })
}
