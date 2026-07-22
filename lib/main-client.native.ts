import NouTubeViewModule from '@/modules/nou-tube-view'
import type { UpdateCheckResult } from '../desktop/src/main/lib/auto-update'

export type FormatOption = { formatId: string; label: string; description: string }
export type PlaylistEntry = { id: string; title: string; url: string }

export interface MainClient {
  clearData(): Promise<void> | void
  toggleInterception(enabled: boolean): Promise<void> | void
  listFormats(url: string): Promise<{ title: string; formats: FormatOption[] }>
  listPlaylist(url: string): Promise<{ title: string; entries: PlaylistEntry[] }>
  enterPictureInPicture(widthRatio: number, heightRatio: number): Promise<boolean>
  setAutoPictureInPicture(enabled: boolean, widthRatio: number, heightRatio: number): Promise<boolean>
  downloadVideo(url: string, formatId: string, outputDir: string): Promise<void>
  getDownloadsPath(): Promise<string>
  selectFolder(): Promise<string | null>
  openFolder(filePath: string): Promise<void> | void
  updateYtDlp(): Promise<void>
  fetchFeed(url: string): Promise<{ ok: boolean; status: number; statusText: string; body: string }>
  setCookie(cookie: string): Promise<void>
  setBlocklist(blocklist: unknown): Promise<void> | void
  isUpdateSupported(): Promise<boolean>
  checkForUpdate(): Promise<UpdateCheckResult>
  quitAndInstall(): Promise<void> | void
}

type NouTubeDownloadClient = {
  listFormats?: MainClient['listFormats']
  listPlaylist?: MainClient['listPlaylist']
  downloadVideo?: MainClient['downloadVideo']
  getDownloadsPath?: MainClient['getDownloadsPath']
  enterPictureInPicture?: MainClient['enterPictureInPicture']
  setAutoPictureInPicture?: MainClient['setAutoPictureInPicture']
  updateYtDlp?: MainClient['updateYtDlp']
}

const nativeModule = NouTubeViewModule as NouTubeDownloadClient

export const mainClient: MainClient = {
  async clearData() {},
  async toggleInterception() {},
  async listFormats(url) {
    if (typeof nativeModule.listFormats !== 'function') {
      throw new Error('download API unavailable')
    }
    return nativeModule.listFormats(url)
  },
  async listPlaylist(url) {
    if (typeof nativeModule.listPlaylist !== 'function') {
      throw new Error('playlist API unavailable')
    }
    return nativeModule.listPlaylist(url)
  },
  async enterPictureInPicture(widthRatio, heightRatio) {
    if (typeof nativeModule.enterPictureInPicture !== 'function') return false
    try {
      return await nativeModule.enterPictureInPicture(widthRatio, heightRatio)
    } catch {
      return false
    }
  },
  async setAutoPictureInPicture(enabled, widthRatio, heightRatio) {
    if (typeof nativeModule.setAutoPictureInPicture !== 'function') return false
    try {
      return await nativeModule.setAutoPictureInPicture(enabled, widthRatio, heightRatio)
    } catch {
      return false
    }
  },
  async downloadVideo(url, formatId, outputDir) {
    if (typeof nativeModule.downloadVideo !== 'function') {
      throw new Error('download API unavailable')
    }
    return nativeModule.downloadVideo(url, formatId, outputDir)
  },
  async getDownloadsPath() {
    if (typeof nativeModule.getDownloadsPath !== 'function') {
      return ''
    }
    try {
      return await nativeModule.getDownloadsPath()
    } catch {
      return ''
    }
  },
  async selectFolder() {
    return null
  },
  async openFolder() {},
  async updateYtDlp() {
    if (typeof nativeModule.updateYtDlp !== 'function') {
      return
    }
    return nativeModule.updateYtDlp()
  },
  async fetchFeed(url) {
    const res = await fetch(url)
    return {
      ok: res.ok,
      status: res.status,
      statusText: res.statusText,
      body: await res.text(),
    }
  },
  async setCookie() {},
  async setBlocklist() {},
  async isUpdateSupported() {
    return false
  },
  async checkForUpdate() {
    return { status: 'not-available' }
  },
  async quitAndInstall() {},
}
