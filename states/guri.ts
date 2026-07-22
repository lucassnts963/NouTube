import { observable } from '@legendapp/state'
import { syncObservable } from '@legendapp/state/sync'
import { ObservablePersistMMKV } from '@legendapp/state/persist-plugins/mmkv'
import { isWeb } from '@/lib/utils'
import { getIndexedDBPlugin } from './indexeddb'
import {
  createDefaultGuriConfig,
  isValidGuriPin,
  parseAllowItem,
  type GuriAllowItem,
  type GuriConfig,
} from '@/lib/guri'
import { genId } from '@/lib/utils'

type BoolFlag =
  | 'restrictedMode'
  | 'hideShorts'
  | 'hideSearch'
  | 'hideComments'
  | 'hideRecommendations'
  | 'allowListMode'

interface Store extends GuriConfig {
  /** Turn parental mode on, setting the unlock PIN. Returns false on a bad PIN. */
  enable: (pin: string) => boolean
  /** Turn it off; requires the current PIN. Returns false on a wrong PIN. */
  disable: (pin: string) => boolean
  setPin: (currentPin: string, nextPin: string) => boolean
  verifyPin: (pin: string) => boolean
  setFlag: (flag: BoolFlag, value: boolean) => void
  /** Add a channel/playlist to the allow-list from a URL. Returns false if unparseable. */
  addAllowItem: (url: string) => boolean
  removeAllowItem: (id: string) => void
  snapshot: () => GuriConfig
}

export const guri$ = observable<Store>({
  ...createDefaultGuriConfig(),

  enable: (pin) => {
    if (!isValidGuriPin(pin)) return false
    guri$.pin.set(pin)
    guri$.enabled.set(true)
    return true
  },

  disable: (pin) => {
    if (!guri$.verifyPin(pin)) return false
    guri$.enabled.set(false)
    return true
  },

  setPin: (currentPin, nextPin) => {
    if (!guri$.verifyPin(currentPin)) return false
    if (!isValidGuriPin(nextPin)) return false
    guri$.pin.set(nextPin)
    return true
  },

  verifyPin: (pin): boolean => {
    const current: string = guri$.pin.get()
    return current.length > 0 && current === pin
  },

  setFlag: (flag, value) => {
    guri$[flag].set(value)
  },

  addAllowItem: (url): boolean => {
    const parsed = parseAllowItem(url)
    if (!parsed) return false
    const existing = guri$.allowList.get()
    if (existing.some((item) => item.type === parsed.type && item.key === parsed.key)) return true
    const item: GuriAllowItem = {
      id: genId(),
      type: parsed.type,
      key: parsed.key,
      url: parsed.url,
      title: defaultAllowTitle(parsed),
    }
    guri$.allowList.push(item)
    return true
  },

  removeAllowItem: (id) => {
    guri$.allowList.set(guri$.allowList.get().filter((item) => item.id !== id))
  },

  snapshot: (): GuriConfig => ({
    enabled: guri$.enabled.get(),
    pin: guri$.pin.get(),
    restrictedMode: guri$.restrictedMode.get(),
    hideShorts: guri$.hideShorts.get(),
    hideSearch: guri$.hideSearch.get(),
    hideComments: guri$.hideComments.get(),
    hideRecommendations: guri$.hideRecommendations.get(),
    allowListMode: guri$.allowListMode.get(),
    allowList: guri$.allowList.get(),
  }),
})

function defaultAllowTitle(parsed: Pick<GuriAllowItem, 'type' | 'key'>): string {
  if (parsed.type === 'playlist') return `Playlist ${parsed.key}`
  return parsed.key.replace(/^channel\//, '').replace(/^c\//, '').replace(/^user\//, '')
}

/**
 * Snapshot sent to the webview. The PIN is stripped — it must never leak into
 * page context.
 */
export const getGuriContentSnapshot = (): Omit<GuriConfig, 'pin'> => {
  const s = guri$.snapshot()
  const { pin: _pin, ...rest } = s
  return rest
}

if (isWeb) {
  syncObservable(guri$, {
    persist: {
      plugin: getIndexedDBPlugin(),
      name: 'store',
      indexedDB: {
        itemID: 'guri',
      },
    },
  })
} else {
  syncObservable(guri$, {
    persist: {
      name: 'guri',
      plugin: ObservablePersistMMKV,
    },
  })
}
