import { Bookmark, bookmarks$, newBookmark } from '@/states/bookmarks'
import pp from 'papaparse'
import { getPageType, getThumbnail, getVideoId, getVideoThumbnail } from './page'
import { showToast } from './toast'
import { normalizeUrl } from './url'
import JSZip from 'jszip'
import { folders$ } from '@/states/folders'
import { history$ } from '@/states/history'
import { importProgress$ } from '@/states/importProgress'

const channelIdRe = /^UC[A-Za-z0-9_-]{22}$/
const videoIdRe = /^[A-Za-z0-9_-]{11}$/
const isoTimestampRe = /^\d{4}-\d{2}-\d{2}T/

export type ImportProgress = (done: number, total: number) => void

// Takeout exports can have tens of thousands of entries. Processing them in
// one synchronous pass blocks the JS thread for the whole import — the UI
// freezes and the progress indicator can't update. Rather than yielding every
// N items (which stalls just as long on a slow device or with heavy items),
// yield whenever more than a frame's worth of time has passed so the app
// always gets scheduling time back, regardless of item cost or hardware.
const YIELD_BUDGET_MS = 12

async function yieldToUI() {
  await new Promise<void>((resolve) => setTimeout(resolve, 0))
}

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
export async function importCsv(csv: string, filename?: string, onProgress?: ImportProgress): Promise<number> {
  const res = pp.parse<string[]>(csv.trim())
  if (!res.data || res.data.length < 1) return 0

  // First row may be a localized header; skip it if it doesn't match an ID pattern.
  let items = res.data
  if (items[0] && !channelIdRe.test(items[0][0] || '') && !videoIdRe.test(items[0][0] || '')) {
    items = items.slice(1)
  }
  if (!items.length) return 0

  const shape = detectShape(items[0])
  let kindLabel = 'items'
  let folder = undefined
  if (shape === 'subscriptions') {
    kindLabel = 'channels'
  } else if (shape === 'playlist-videos') {
    kindLabel = 'videos'
    if (filename) {
      const playlistName = filename.split('-')[0]
      if (playlistName) {
        folder = folders$.getOrCreateFolder('watch', playlistName)
      }
    }
  } else if (shape === 'music-songs') {
    kindLabel = 'songs'
  } else {
    return 0
  }

  // No per-item network fetch: titles come from the CSV and video thumbnails are
  // derived from the id. That keeps a big Takeout export instant instead of doing
  // hundreds of sequential requests to youtube.com (which hang on mobile).
  const bookmarks: Bookmark[] = []
  let lastYield = Date.now()
  for (let i = 0; i < items.length; i++) {
    const [id, urlOrTitle, title] = items[i]
    if (shape === 'subscriptions') {
      if (id && urlOrTitle) bookmarks.push(newBookmark({ url: urlOrTitle, title: title || '', json: { id } }))
    } else if (shape === 'playlist-videos') {
      if (id) {
        const url = `https://m.youtube.com/watch?v=${id}`
        bookmarks.push(newBookmark({ url, title: '', json: { folder: folder?.id, thumbnail: getVideoThumbnail(id) } }))
      }
    } else if (shape === 'music-songs') {
      if (id) {
        const url = `https://music.youtube.com/watch?v=${id}`
        bookmarks.push(newBookmark({ url, title: urlOrTitle || '' }))
      }
    }

    if (Date.now() - lastYield > YIELD_BUDGET_MS) {
      onProgress?.(i, items.length)
      await yieldToUI()
      lastYield = Date.now()
    }
  }
  onProgress?.(items.length, items.length)

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

export async function parseHistoryJson(text: string, onProgress?: ImportProgress): Promise<ParsedHistoryItem[]> {
  let data: unknown
  try {
    data = JSON.parse(text)
  } catch {
    return []
  }
  if (!Array.isArray(data)) return []

  const entries = data as Array<Record<string, any>>
  const out: ParsedHistoryItem[] = []
  let lastYield = Date.now()
  for (let i = 0; i < entries.length; i++) {
    const entry = entries[i]
    const titleUrl: unknown = entry?.titleUrl
    if (typeof titleUrl === 'string' && titleUrl.includes('watch?v=')) {
      const videoId = getVideoId(titleUrl) || ''
      if (videoIdRe.test(videoId)) {
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
    }

    if (Date.now() - lastYield > YIELD_BUDGET_MS) {
      onProgress?.(i, entries.length)
      await yieldToUI()
      lastYield = Date.now()
    }
  }
  onProgress?.(entries.length, entries.length)
  return out
}

const HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
}

function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity[0] === '#') {
      const isHex = entity[1]?.toLowerCase() === 'x'
      const code = parseInt(entity.slice(isHex ? 2 : 1), isHex ? 16 : 10)
      return Number.isNaN(code) ? match : String.fromCodePoint(code)
    }
    return HTML_ENTITIES[entity.toLowerCase()] ?? match
  })
}

function stripTags(text: string): string {
  return text.replace(/<[^>]+>/g, ' ')
}

// Matches every `<a href="...watch?v=...">title</a>` in the raw markup.
const watchAnchorRe = /<a\s+[^>]*href="([^"]*watch\?v=[^"]*)"[^>]*>([\s\S]*?)<\/a>/gi

export async function parseHistoryHtml(html: string, onProgress?: ImportProgress): Promise<ParsedHistoryItem[]> {
  // A full DOM parse (cheerio/htmlparser2) builds a tree with attributes,
  // parent/sibling links etc. for every tag in the file — for a big Takeout
  // export (tens of MB of HTML) that's the single most expensive step, and
  // it can't be chunked or yielded mid-parse. We only ever need the watch
  // links and the date text that follows them, so scan for those directly
  // with a regex instead: no tree to build, dramatically less work per byte,
  // and it's what makes it possible to start reporting progress almost
  // immediately instead of staring at a blank spinner during the parse.
  const matches = [...html.matchAll(watchAnchorRe)]

  const out: ParsedHistoryItem[] = []
  const now = Date.now()
  let index = 0
  const seen = new Set<string>()
  let lastYield = Date.now()

  for (let i = 0; i < matches.length; i++) {
    const match = matches[i]
    const href = match[1]
    const videoId = getVideoId(href) || ''
    if (videoIdRe.test(videoId) && !seen.has(videoId)) {
      const title = decodeHtmlEntities(stripTags(match[2])).trim()

      // The entry's date sits as trailing text right after this link (and an
      // optional channel link). Scan up to the next match (or a bounded
      // window) so a dense export can't bleed into a neighboring entry.
      const matchStart = match.index ?? 0
      const sliceEnd = Math.min(matches[i + 1]?.index ?? html.length, matchStart + 600)
      const tail = stripTags(html.slice(matchStart + match[0].length, sliceEnd)).replace(/\s+/g, ' ')

      // The exact date format is localized, so parse best-effort and
      // otherwise fall back to document order (Takeout lists newest first)
      // to keep the timeline sane. The trailing part is bounded (AM/PM +
      // a short timezone abbreviation) rather than a greedy run of
      // non-comma text — unlike cheerio's DOM-scoped cell.text(), this
      // regex scan has no element boundary, so an unbounded tail could eat
      // into the next entry's text (e.g. "...PST Watched" from the row below).
      let updatedAt = now - index * 1000
      const dateMatch = tail.match(/[A-Za-z]{3,}\s+\d{1,2},\s+\d{4},?\s+\d{1,2}:\d{2}:\d{2}(?:\s*[AP]M)?(?:\s+[A-Z]{2,5})?/)
      if (dateMatch) {
        const t = Date.parse(dateMatch[0])
        if (!Number.isNaN(t)) updatedAt = t
      }
      index += 1
      seen.add(videoId)

      out.push({
        videoId,
        url: `https://m.youtube.com/watch?v=${videoId}`,
        title,
        thumbnail: getVideoThumbnail(videoId),
        updatedAt,
      })
    }

    if (Date.now() - lastYield > YIELD_BUDGET_MS) {
      onProgress?.(i, matches.length)
      await yieldToUI()
      lastYield = Date.now()
    }
  }
  onProgress?.(matches.length, matches.length)
  return out
}

export async function importHistory(text: string, filename?: string, onProgress?: ImportProgress): Promise<number> {
  const lower = filename?.toLowerCase()
  const isJson = lower ? lower.endsWith('.json') : looksLikeJson(text)
  const items = isJson ? await parseHistoryJson(text, onProgress) : await parseHistoryHtml(text, onProgress)
  if (!items.length) return 0

  history$.importHistory(items)
  showToast(`🎉 Imported ${items.length} history items`)
  return items.length
}

async function importTakeoutFile(label: string, text: string, isHistory: boolean): Promise<number> {
  const stepId = importProgress$.addStep(label)
  const onProgress: ImportProgress = (done, total) => importProgress$.updateStep(stepId, { done, total })
  try {
    const count = isHistory ? await importHistory(text, label, onProgress) : await importCsv(text, label, onProgress)
    importProgress$.updateStep(stepId, {
      status: 'done',
      resultLabel: count > 0 ? `${count} imported` : 'Nothing recognized',
    })
    return count
  } catch (e) {
    console.error(`Failed to process ${label}:`, e)
    importProgress$.updateStep(stepId, { status: 'error', resultLabel: 'Failed' })
    return 0
  }
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

  const files = [...csvFiles, ...historyFiles]
  importProgress$.reset()

  // Process sequentially to save memory.
  let total = 0
  for (const file of files) {
    const isHistory = historyFiles.includes(file)
    const label = file.name.split('/').at(-1) || file.name
    try {
      const text = await file.async('string')
      total += await importTakeoutFile(label, text, isHistory)
      // Small pause to allow GC to work
      await new Promise((resolve) => setTimeout(resolve, 50))
    } catch (e) {
      console.error(`Failed to read ${file.name} from zip:`, e)
    }
  }
  importProgress$.finish()
  if (total === 0) {
    showToast("Nothing recognized in zip — make sure it's a YouTube Takeout export")
  }
}

/** Same per-file progress screen as importZip, for files already extracted to disk (the Android native zip-extraction path). */
export async function importExtractedFiles(files: Array<{ name: string; uri: string }>) {
  importProgress$.reset()

  let total = 0
  for (const file of files) {
    const label = file.name.split('/').at(-1) || file.name
    try {
      const response = await fetch(file.uri)
      const text = await response.text()
      total += await importTakeoutFile(label, text, isHistoryFilename(file.name))
      await new Promise((resolve) => setTimeout(resolve, 50))
    } catch (e) {
      console.error(`Failed to read ${file.name}:`, e)
    }
  }
  importProgress$.finish()
  if (total === 0) {
    showToast("Nothing recognized in zip — make sure it's a YouTube Takeout export")
  }
  return total
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
