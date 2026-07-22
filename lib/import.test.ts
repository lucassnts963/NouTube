import { describe, expect, it } from 'bun:test'
import { parseHistoryJson, parseHistoryHtml, isHistoryFilename } from './import'

describe('isHistoryFilename', () => {
  it('matches Takeout watch-history exports', () => {
    expect(isHistoryFilename('watch-history.json')).toBe(true)
    expect(isHistoryFilename('watch-history.html')).toBe(true)
    expect(isHistoryFilename('Takeout/YouTube/history/watch-history.json')).toBe(true)
    expect(isHistoryFilename('subscriptions.csv')).toBe(false)
    expect(isHistoryFilename(undefined)).toBe(false)
  })
})

describe('parseHistoryJson', () => {
  it('extracts video id, title, thumbnail and time', () => {
    const json = JSON.stringify([
      {
        header: 'YouTube',
        title: 'Watched Never Gonna Give You Up',
        titleUrl: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
        subtitles: [{ name: 'Rick Astley', url: 'https://www.youtube.com/channel/UCxxxx' }],
        time: '2024-01-02T03:04:05.000Z',
      },
      // Removed / adless entries have no titleUrl and must be skipped.
      { header: 'YouTube', title: 'Watched a video that has been removed' },
      // Non-watch activity (e.g. a channel visit) must be skipped.
      { header: 'YouTube', title: 'Visited', titleUrl: 'https://www.youtube.com/channel/UCyyyy' },
    ])

    const items = parseHistoryJson(json)
    expect(items).toHaveLength(1)
    expect(items[0].videoId).toBe('dQw4w9WgXcQ')
    expect(items[0].title).toBe('Never Gonna Give You Up')
    expect(items[0].url).toBe('https://m.youtube.com/watch?v=dQw4w9WgXcQ')
    expect(items[0].thumbnail).toContain('dQw4w9WgXcQ')
    expect(items[0].updatedAt).toBe(Date.parse('2024-01-02T03:04:05.000Z'))
  })

  it('returns empty for malformed input', () => {
    expect(parseHistoryJson('not json')).toEqual([])
    expect(parseHistoryJson('{}')).toEqual([])
  })
})

describe('parseHistoryHtml', () => {
  it('extracts entries and dedupes repeated videos', () => {
    const html = `
      <div class="outer-cell">
        <div class="content-cell">
          Watched&nbsp;<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Some Title</a><br>
          <a href="https://www.youtube.com/channel/UCxxxx">Rick Astley</a><br>
          Jan 2, 2024, 3:04:05 AM PST
        </div>
      </div>
      <div class="outer-cell">
        <div class="content-cell">
          Watched&nbsp;<a href="https://www.youtube.com/watch?v=dQw4w9WgXcQ">Some Title</a><br>
          Jan 1, 2024, 1:00:00 AM PST
        </div>
      </div>
      <div class="outer-cell">
        <div class="content-cell">
          Watched&nbsp;<a href="https://www.youtube.com/watch?v=9bZkp7q19f0">Another</a><br>
          Jan 3, 2024, 5:00:00 AM PST
        </div>
      </div>`

    const items = parseHistoryHtml(html)
    expect(items).toHaveLength(2)
    expect(items.map((x) => x.videoId).sort()).toEqual(['9bZkp7q19f0', 'dQw4w9WgXcQ'])
    const rick = items.find((x) => x.videoId === 'dQw4w9WgXcQ')!
    expect(rick.title).toBe('Some Title')
    expect(rick.updatedAt).toBe(Date.parse('Jan 2, 2024, 3:04:05 AM PST'))
  })
})
