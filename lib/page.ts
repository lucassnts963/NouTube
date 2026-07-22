import { ui$, updateUrl } from '@/states/ui'
import { onReceiveAuthUrl } from './supabase/auth'
import { settings$ } from '@/states/settings'
import { debounce } from 'es-toolkit'
import { isSupportedUrl, normalizeSupportedUrl } from './supported-url'
import { removeTrackingParams } from './tracking-url'

export { getPageType } from './page-type'

export function fixPageTitle(title: string) {
  return title.replace(/ - YouTube( Music)*$/, '')
}

export function fixSharingUrl(v: string) {
  return removeTrackingParams(v)
}

export function getVideoThumbnail(id: string) {
  return `https://img.youtube.com/vi/${id}/hqdefault.jpg`
}

/* https://www.youtube.com/watch?v=<id> */
export function getVideoId(url: string) {
  try {
    return new URL(url).searchParams.get('v')
  } catch {
    return ''
  }
}

export function getThumbnail(url: string) {
  const id = getVideoId(url)
  return id ? getVideoThumbnail(id) : undefined
}

/**
 * Returns the `list` id of a real, enumerable playlist, or '' otherwise.
 * Auto-generated radio/mix playlists (RD...) are endless and can't be listed,
 * so they're treated as "not a playlist".
 */
export function getPlaylistId(url: string) {
  try {
    const list = new URL(url).searchParams.get('list') || ''
    if (!list || list.startsWith('RD')) return ''
    return list
  } catch {
    return ''
  }
}

export function openSharedUrl(url: string) {
  if (url.startsWith('noutube:auth')) {
    onReceiveAuthUrl(url)
    return
  }
  try {
    const fixed = fixSharingUrl(url)
    if (isSupportedUrl(fixed)) {
      updateUrl(normalizeSupportedUrl(fixed))
    }
  } catch (error) {
    console.error(error)
  }
}

export const setPageUrl = debounce(async function (url: string) {
  if (!url) {
    return
  }
  ui$.pageUrl.set(url)
  const { host } = new URL(url)
  settings$.home.set(host === 'music.youtube.com' ? 'yt-music' : 'yt')
}, 300)
