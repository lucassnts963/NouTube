import { Bookmark, bookmarks$, newBookmark } from '@/states/bookmarks'
import pp from 'papaparse'
import * as cheerio from 'cheerio/slim'
import { getPageType, getThumbnail, getVideoId, getVideoThumbnail } from './page'
import { showToast } from './toast'
import { normalizeUrl } from './url'
import JSZip from 'jszip'
import { folders$ } from '@/states/folders'
import { history$ } from '@/states/history'

const channelIdRe = /^UC[A-Za-z0-9_-]{22}$/
const videoIdRe = /^[A-Za-z0-9_-]{11}$/
const isoTimestampRe = /^\d{4}-\d{2}-\d{2}T/

type CsvShape = 'subscriptions' | 'playlist-videos' | 'music-songs' | null

function detectShape(row: string[]): CsvShape {
  const [c0, c1] = row
  if (!c0) return null
  if (channelIdRe.test(c0) && c1 && /youtube\.com\/channel\//i.test(c1)) {
    return 'subscriptions'
  }
  if (videoIdRe.test(c0)) {
    if (c1 && isoTimestampRe.test(c1)) return 'playlist-videos'
    return 'music-songs'
  }
  return null
}

/**
 * Visit https://myaccount.google.com/u/0/yourdata/youtube, in the "Your YouTube
 * dashboard" panel, click More -> Download Data. You will get a few csv files.
 *
 * Detection is based on row shape rather than header text, so localized
 * Takeout exports (non-English column headers and filenames) work too.
 */
export async function importCsv(csv: string, filename?: string): Promise<number> {
  const res = pp.parse<string[]>(csv.trim())
  if (!res.data || res.data.length < 1) return 0

  // First row may be a localized header; skip it if it doesn't match an ID pattern.
  let items = res.data
  if (items[0] && !channelIdRe.test(items[0][0] || '') && !videoIdRe.test(items[0][0] || '')) {
    items = items.slice(1)
  }
  if (!items.length) return 0

  const shape = detectShape(items[0])
  let bookmarks: Bookmark[] = []
  let kindLabel = 'items'

  // No per-item network fetch: titles come from the CSV and video thumbnails are
  // derived from the id. That keeps a big Takeout export instant instead of doing
  // hundreds of sequential requests to youtube.com (which hang on mobile).
  if (shape === 'subscriptions') {
    kindLabel = 'channels'
    for (const [id, url, title] of items) {
      if (!id || !url) continue
      bookmarks.push(newBookmark({ url, title: title || '', json: { id } }))
    }
  } else if (shape === 'playlist-videos') {
    kindLabel = 'videos'
    let folder = undefined
    if (filename) {
      const playlistName = filename.split('-')[0]
      if (playlistName) {
        folder = folders$.getOrCreateFolder('watch', playlistName)
      }
    }
    for (const [id] of items) {
      if (!id) continue
      const url = `https://m.youtube.com/watch?v=${id}`
      bookmarks.push(newBookmark({ url, title: '', json: { folder: folder?.id, thumbnail: getVideoThumbnail(id) } }))
    }
  } else if (shape === 'music-songs') {
    kindLabel = 'songs'
    for (const [id, title] of items) {
      if (!id) continue
      const url = `https://music.youtube.com/watch?v=${id}`
      bookmarks.push(newBookmark({ url, title: title || '' }))
    }
  } else {
    return 0
  }

  if (!bookmarks.length) return 0
  const count = bookmarks.length
  bookmarks$.importBookmarks(bookmarks)
  showToast(`🎉 Imported ${count} ${kindLabel}`)
  return count
}

export interface ParsedHistoryItem {
  videoId: string
  url: string
  title: string
  thumbnail: string
  updatedAt: number
}

/**
 * A Takeout watch-history export ships either as watch-history.json or
 * watch-history.html, depending on the format chosen in Takeout.
 */
export function isHistoryFilename(name?: string): boolean {
  if (!name) return false
  const n = name.toLowerCase()
  return n.includes('watch-history') && (n.endsWith('.json') || n.endsWith('.html'))
}

function looksLikeJson(text: string): boolean {
  const t = text.trimStart()
  return t.startsWith('[') || t.startsWith('{')
}

export function parseHistoryJson(text: string): ParsedHistoryItem[] {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []

  const out: ParsedHistoryItem[] = []
  for (const entry of data as Array<Record<string, any>>) {
    const titleUrl: unknown = entry?.titleUrl
    if (typeof titleUrl !== 'string' || !titleUrl.includes('watch?v=')) continue
    const videoId = getVideoId(titleUrl) || ''
    if (!videoIdRe.test(videoId)) continue

    // Takeout prefixes the title with a localized "Watched " verb; strip the
    // common English one so bookmarks read cleanly.
    let title = typeof entry?.title === 'string' ? entry.title : ''
    title = title.replace(/^Watched\s+/, '')

    let updatedAt = 0
    if (typeof entry?.time === 'string') {
      const t = Date.parse(entry.time)
      if (!Number.isNaN(t)) updatedAt = t
    }

    out.push({
      videoId,
      url: `https://m.youtube.com/watch?v=${videoId}`,
      title,
      thumbnail: getVideoThumbnail(videoId),
      updatedAt,
    })
  }
  return out
}

export function parseHistoryHtml(html: string): ParsedHistoryItem[] {
  const $ = cheerio.load(html)
  const out: ParsedHistoryItem[] = []
  const now = Date.now()
  let index = 0
  const seen = new Set<string>()

  $('a[href*="watch?v="]').each((_, el) => {
    const link = $(el)
    const href = link.attr('href')
    if (!href) return
    const videoId = getVideoId(href) || ''
    if (!videoIdRe.test(videoId)) return

    const title = link.text().trim()

    // The activity cell holds the entry's timestamp as trailing text. Its exact
    // format is localized, so parse best-effort and otherwise fall back to the
    // document order (Takeout lists newest first) to keep the timeline sane.
    let updatedAt = now - index * 1000
    const cell = link.closest('.content-cell, .outer-cell')
    const cellText = (cell.length ? cell.text() : '').replace(/\s+/g, ' ')
    const dateMatch = cellText.match(/[A-Za-z]{3,}\s+\d{1,2},\s+\d{4},?\s+\d{1,2}:\d{2}:\d{2}[^,]*/)
    if (dateMatch) {
      const t = Date.parse(dateMatch[0])
      if (!Number.isNaN(t)) updatedAt = t
    }
    index += 1

    if (seen.has(videoId)) return
    seen.add(videoId)

    out.push({
      videoId,
      url: `https://m.youtube.com/watch?v=${videoId}`,
      title,
      thumbnail: getVideoThumbnail(videoId),
      updatedAt,
    })
  })
  return out
}

export async function importHistory(text: string, filename?: string): Promise<number> {
  const lower = filename?.toLowerCase()
  const isJson = lower ? lower.endsWith('.json') : looksLikeJson(text)
  const items = isJson ? parseHistoryJson(text) : parseHistoryHtml(text)
  if (!items.length) return 0

  history$.importHistory(items)
  showToast(`🎉 Imported ${items.length} history items`)
  return items.length
}

export async function importZip(zip: JSZip) {
  const csvFiles: JSZip.JSZipObject[] = []
  const historyFiles: JSZip.JSZipObject[] = []
  zip.forEach((_, file) => {
    // Folder names inside Takeout are localized, so don't filter by them.
    // importCsv detects the CSV type by row shape and ignores the rest.
    const lower = file.name.toLowerCase()
    if (lower.endsWith('.csv')) {
      csvFiles.push(file)
    } else if (isHistoryFilename(file.name)) {
      historyFiles.push(file)
    }
  })

  // Process sequentially to save memory
  let total = 0
  for (const file of csvFiles) {
    try {
      const csv = await file.async('string')
      const slugs = file.name.split('/')
      total += await importCsv(csv, slugs.at(-1))
      // Small pause to allow GC to work
      await new Promise((resolve) => setTimeout(resolve, 50))
    } catch (e) {
      console.error(`Failed to process ${file.name} from zip:`, e)
    }
  }
  for (const file of historyFiles) {
    try {
      const text = await file.async('string')
      total += await importHistory(text, file.name.split('/').at(-1))
      await new Promise((resolve) => setTimeout(resolve, 50))
    } catch (e) {
      console.error(`Failed to process ${file.name} from zip:`, e)
    }
  }
  if (total === 0) {
    showToast("Nothing recognized in zip — make sure it's a YouTube Takeout export")
  }
}

export async function importList(list: string) {
  let sep = list.includes('\r\n') ? '\r\n' : '\n'
  const lines = list.split(sep)
  let bookmarks: Bookmark[] = []
  for (const line of lines) {
    const pageType = getPageType(line)
    if (!pageType?.canStar) {
      continue
    }
    const url = normalizeUrl(line)
    bookmarks.push(newBookmark({ url, title: '', json: { thumbnail: getThumbnail(url) } }))
  }

  if (bookmarks.length) {
    const count = bookmarks$.importBookmarks(bookmarks)
    showToast(`🎉 Imported ${count} pages`)
  }
}
