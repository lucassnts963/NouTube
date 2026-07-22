import { observable } from '@legendapp/state'
import type { LocalMedia } from './local-library'

interface Store {
  current: LocalMedia | null
  open: (media: LocalMedia) => void
  close: () => void
}

export const player$ = observable<Store>({
  current: null,
  open: (media) => {
    player$.current.set(media)
  },
  close: () => {
    player$.current.set(null)
  },
})
