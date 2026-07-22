import { registerWebModule, NativeModule } from 'expo'

class NouTubeViewModule extends NativeModule {
  setSettings() {}

  extractTakeoutCsvFiles() {
    throw new Error('extractTakeoutCsvFiles is only available on Android')
  }

  async listPlaylist() {
    throw new Error('listPlaylist is only available on Android')
  }

  async enterPictureInPicture() {
    return false
  }

  async setAutoPictureInPicture() {
    return false
  }

  async setSleepTimer() {
    throw new Error('sleep timer is only available on Android')
  }

  async clearSleepTimer() {
    throw new Error('sleep timer is only available on Android')
  }

  async getSleepTimerRemainingMs() {
    return null
  }
}

export default registerWebModule(NouTubeViewModule, 'NouTubeViewModule')
