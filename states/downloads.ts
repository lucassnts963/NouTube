import { observable } from '@legendapp/state'

export type DownloadPhase = 'downloading' | 'done' | 'error'

export type MediaKind = 'audio' | 'video'

export interface DownloadState {
  url: string
  title: string
  phase: DownloadPhase
  progress: number
  progressLine: string
  errorMsg: string
  savedPath: string
  kind?: MediaKind
}

/** Infer whether a yt-dlp format selector produces audio-only or video. */
export function inferMediaKind(formatId: string): MediaKind {
  return formatId.startsWith('bestaudio') ? 'audio' : 'video'
}

export const downloads$ = observable<Record<string, DownloadState>>({})
