import { ActivityIndicator, Pressable, ScrollView, TextInput, View, useColorScheme } from 'react-native'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useValue } from '@legendapp/state/react'
import { ui$ } from '@/states/ui'
import { settings$ } from '@/states/settings'
import { BaseModal } from './BaseModal'
import { NouText } from '../NouText'
import { NouButton } from '../button/NouButton'
import { mainClient } from '@/lib/main-client'
import { downloads$, inferMediaKind } from '@/states/downloads'
import { t } from 'i18next'
import type { FormatOption } from '@/lib/main-client'
import { isAndroid, nIf } from '@/lib/utils'
import { getPlaylistId, getVideoId } from '@/lib/page'
import { showToast } from '@/lib/toast'
import MaterialIcons from '@react-native-vector-icons/material-icons'

type Phase = 'idle' | 'loading' | 'choosing' | 'error'

// Whole-playlist downloads can't probe per-video formats, so offer a fixed set
// of generic yt-dlp quality selectors applied to every video in the playlist.
const getPlaylistFormats = (): FormatOption[] => [
  {
    formatId: 'bestvideo[height<=1080]+bestaudio/best[height<=1080]',
    label: '1080p',
    description: t('modals.playlistVideoDesc', 'Video, up to 1080p'),
  },
  {
    formatId: 'bestvideo[height<=720]+bestaudio/best[height<=720]',
    label: '720p',
    description: t('modals.playlistVideo720Desc', 'Video, up to 720p'),
  },
  {
    formatId: 'bestaudio-mp3',
    label: t('modals.playlistAudioMp3', 'Audio (mp3)'),
    description: t('modals.playlistAudioMp3Desc', 'MP3 audio with cover art'),
  },
  {
    formatId: 'bestaudio/best',
    label: t('modals.playlistAudio', 'Audio only'),
    description: t('modals.playlistAudioDesc', 'Best audio stream'),
  },
]

export const ToolsModal = () => {
  const toolsModalOpen = useValue(ui$.toolsModalOpen)
  const toolsModalUrl = useValue(ui$.toolsModalUrl)
  const isOpen = toolsModalOpen || !!toolsModalUrl
  const downloadPath = useValue(settings$.downloadPath)
  const [url, setUrl] = useState('')
  const [resolvedDownloadsPath, setResolvedDownloadsPath] = useState('')
  const [phase, setPhase] = useState<Phase>('idle')
  const [playlistBusy, setPlaylistBusy] = useState(false)
  const [formats, setFormats] = useState<FormatOption[]>([])
  const [parsedTitle, setParsedTitle] = useState('')
  const [errorMsg, setErrorMsg] = useState('')
  const activeDownloads = useValue(downloads$)
  const loadingUrlRef = useRef('')
  const isDark = useColorScheme() !== 'light'
  const effectiveDownloadPath = downloadPath || resolvedDownloadsPath

  const onClose = () => {
    ui$.toolsModalOpen.set(false)
    ui$.toolsModalUrl.set('')
  }

  const loadFormats = useCallback((targetUrl: string) => {
    loadingUrlRef.current = targetUrl
    setPhase('loading')
    setFormats([])
    setParsedTitle('')
    setErrorMsg('')
    mainClient
      .listFormats(targetUrl)
      .then((result) => {
        if (loadingUrlRef.current !== targetUrl) return
        setFormats(result.formats)
        setParsedTitle(result.title)
        setPhase('choosing')
      })
      .catch((err: any) => {
        if (loadingUrlRef.current !== targetUrl) return
        setErrorMsg(err?.message || t('modals.failedToLoadFormats'))
        setPhase('error')
      })
  }, [])

  useEffect(() => {
    mainClient.getDownloadsPath().then(setResolvedDownloadsPath)
  }, [])

  useEffect(() => {
    if (!isOpen) return
    if (toolsModalUrl) {
      setUrl(toolsModalUrl)
      // A bare playlist URL has no video to probe formats for; just show the
      // playlist download options.
      if (getVideoId(toolsModalUrl)) {
        loadFormats(toolsModalUrl)
      } else {
        setPhase('idle')
      }
    } else {
      setUrl('')
      setPhase('idle')
    }
    setFormats([])
  }, [isOpen, toolsModalUrl, loadFormats])

  const handleDownload = (formatId: string) => {
    const targetUrl = toolsModalUrl || url
    downloads$[targetUrl].set({
      url: targetUrl,
      title: parsedTitle || targetUrl,
      phase: 'downloading',
      progress: 0,
      progressLine: '',
      errorMsg: '',
      savedPath: '',
      kind: inferMediaKind(formatId),
    })
    setPhase('idle')
    setUrl('')
    ui$.toolsModalUrl.set('')

    mainClient.downloadVideo(targetUrl, formatId, effectiveDownloadPath).catch(() => {
      // handled via downloadProgress done+error
    })
  }

  const handleDownloadPlaylist = async (formatId: string) => {
    if (playlistBusy) return
    const targetUrl = toolsModalUrl || url
    const dir = effectiveDownloadPath
    setPlaylistBusy(true)
    try {
      const info = await mainClient.listPlaylist(targetUrl)
      const entries = info.entries ?? []
      if (!entries.length) {
        showToast(t('modals.playlistEmpty', 'No videos found in this playlist'))
        return
      }

      // Seed every entry so they show up in the download list immediately.
      for (const entry of entries) {
        downloads$[entry.url].set({
          url: entry.url,
          title: entry.title || entry.url,
          phase: 'downloading',
          progress: 0,
          progressLine: '',
          errorMsg: '',
          savedPath: '',
          kind: inferMediaKind(formatId),
        })
      }

      setPhase('idle')
      setUrl('')
      ui$.toolsModalUrl.set('')
      showToast(t('modals.playlistQueued', 'Downloading {{count}} videos').replace('{{count}}', String(entries.length)))

      // Download sequentially to avoid spawning many yt-dlp processes at once.
      for (const entry of entries) {
        try {
          await mainClient.downloadVideo(entry.url, formatId, dir)
        } catch {
          // per-item failure is surfaced via downloadProgress done+error
        }
      }
    } catch (err: any) {
      showToast(err?.message || t('modals.failedToLoadFormats'))
    } finally {
      setPlaylistBusy(false)
    }
  }

  if (!isOpen) return null

  const currentUrl = toolsModalUrl || url
  const playlistId = getPlaylistId(currentUrl)
  const playlistFormats = getPlaylistFormats()

  const activeDownloadUrls = Object.keys(activeDownloads).reverse()
  const getProgressValue = (value: number) => Math.min(100, Math.max(0, Number.isFinite(value) ? value : 0))

  return (
    <BaseModal onClose={onClose}>
      <ScrollView className="flex-1" contentContainerClassName="p-5 gap-4" keyboardShouldPersistTaps="handled">
        <View className="flex-row items-center justify-between">
          <NouText className="text-lg font-semibold">{t('modals.downloadVideo', 'Download video')}</NouText>
        </View>

        <View className="gap-1">
          <NouText className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">URL</NouText>
          <TextInput
            className="rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 text-sm text-zinc-900 dark:text-zinc-100"
            value={url}
            onChangeText={(v) => {
              setUrl(v)
              setPhase('idle')
              setFormats([])
            }}
            onSubmitEditing={() => {
              const trimmed = url.trim()
              if (trimmed) loadFormats(trimmed)
            }}
            returnKeyType="go"
            placeholder="https://www.youtube.com/watch?v=..."
            placeholderTextColor={isDark ? '#71717a' : '#a1a1aa'}
          />
        </View>

        {nIf(
          !isAndroid && (phase === 'idle' || phase === 'choosing'),
          <View className="gap-1">
            <NouText className="text-sm font-semibold text-zinc-500 dark:text-zinc-400">{t('modals.folder')}</NouText>
            <Pressable
              className="flex-row items-center gap-2 rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 p-2 active:bg-zinc-100 dark:active:bg-zinc-800"
              onPress={async () => {
                const picked = await mainClient.selectFolder()
                if (picked) settings$.downloadPath.set(picked)
              }}
            >
              <NouText className="flex-1 text-sm text-zinc-700 dark:text-zinc-300" numberOfLines={1}>
                {effectiveDownloadPath || t('modals.downloadsFolder')}
              </NouText>
              <NouText className="text-xs text-zinc-400 dark:text-zinc-500">{t('buttons.browse')}</NouText>
            </Pressable>
          </View>,
        )}

        {!!playlistId && (
          <View className="gap-3">
            <View className="flex-row items-center gap-2">
              <MaterialIcons name="playlist-play" size={20} color={isDark ? '#a5b4fc' : '#4f46e5'} />
              <NouText className="text-base font-semibold">
                {t('modals.downloadPlaylist', 'Download whole playlist')}
              </NouText>
            </View>
            {playlistFormats.map((opt) => (
              <View
                key={opt.formatId}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 gap-3"
              >
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 gap-1">
                    <NouText className="font-semibold">{opt.label}</NouText>
                    <NouText className="text-sm text-zinc-500 dark:text-zinc-400">{opt.description}</NouText>
                  </View>
                  <Pressable
                    disabled={playlistBusy}
                    onPress={() => handleDownloadPlaylist(opt.formatId)}
                    className={
                      playlistBusy
                        ? 'h-11 w-11 items-center justify-center rounded-full bg-zinc-300 dark:bg-zinc-700'
                        : 'h-11 w-11 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 active:bg-indigo-700 dark:active:bg-indigo-400'
                    }
                  >
                    <MaterialIcons name="download" size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
            {nIf(playlistBusy, <ActivityIndicator color={isDark ? 'white' : '#3f3f46'} />)}
          </View>
        )}

        {/* Hide the single-video "Next" only for a bare playlist URL, where the
            playlist section above already provides the download actions. */}
        {phase === 'idle' && !(playlistId && !getVideoId(currentUrl)) && (
          <View className="flex-row justify-end">
            <NouButton disabled={!url.trim()} onPress={() => loadFormats(url.trim())}>
              {t('buttons.next')}
            </NouButton>
          </View>
        )}

        {phase === 'loading' && <ActivityIndicator color={isDark ? 'white' : '#3f3f46'} />}

        {phase === 'choosing' && (
          <View className="gap-3">
            {!!parsedTitle && (
              <NouText className="text-sm font-medium text-zinc-600 dark:text-zinc-400 italic px-1">
                {parsedTitle}
              </NouText>
            )}
            {formats.map((opt) => (
              <View
                key={opt.formatId}
                className="rounded-xl border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-900 p-4 gap-3"
              >
                <View className="flex-row items-center gap-3">
                  <View className="flex-1 gap-1">
                    <NouText className="font-semibold">{opt.label}</NouText>
                    <NouText className="text-sm text-zinc-500 dark:text-zinc-400">{opt.description}</NouText>
                  </View>
                  <Pressable
                    onPress={() => handleDownload(opt.formatId)}
                    className="h-11 w-11 items-center justify-center rounded-full bg-indigo-600 dark:bg-indigo-500 active:bg-indigo-700 dark:active:bg-indigo-400"
                  >
                    <MaterialIcons name="download" size={20} color="#fff" />
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        )}

        {phase === 'error' && (
          <View className="gap-3">
            <NouText className="text-sm text-red-500 dark:text-red-400">
              {errorMsg || t('modals.failedToLoadFormats')}
            </NouText>
          </View>
        )}

        {activeDownloadUrls.length > 0 && (
          <View className="mt-4 gap-4">
            <View className="flex-row items-center justify-between">
              <NouText className="text-sm font-bold uppercase tracking-widest text-zinc-500">
                {t('modals.downloadHistory')}
              </NouText>
              <Pressable
                onPress={() => {
                  downloads$.set({})
                }}
                className="px-2 py-1 rounded-md active:bg-zinc-200 dark:active:bg-zinc-800"
              >
                <NouText className="text-xs text-zinc-500 font-medium">{t('buttons.clearAll')}</NouText>
              </Pressable>
            </View>
            {activeDownloadUrls.map((dUrl) => {
              const d = activeDownloads[dUrl]
              return (
                <View
                  key={dUrl}
                  className={
                    d.phase === 'done'
                      ? 'rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white/80 dark:bg-zinc-900 p-4 gap-2'
                      : d.phase === 'error'
                        ? 'rounded-xl border border-red-300 dark:border-red-900 bg-red-50 dark:bg-red-950/30 p-4 gap-2'
                        : 'rounded-xl border border-sky-200 dark:border-sky-900 bg-sky-50/70 dark:bg-sky-950/30 p-4 gap-2'
                  }
                >
                  <View className="flex-row items-start justify-between gap-3">
                    <View className="flex-1 gap-1">
                      <NouText className="text-sm font-semibold text-zinc-900 dark:text-zinc-100" numberOfLines={2}>
                        {d.title || dUrl}
                      </NouText>
                    </View>
                    {nIf(
                      d.phase === 'error',
                      <MaterialIcons name="error-outline" size={18} color={isDark ? '#f87171' : '#dc2626'} />,
                    )}
                    {nIf(
                      d.phase === 'downloading',
                      <ActivityIndicator size="small" color={isDark ? '#7dd3fc' : '#0284c7'} />,
                    )}
                  </View>
                  {d.phase === 'downloading' && (
                    <View className="h-2 overflow-hidden rounded-full bg-sky-100 dark:bg-sky-950">
                      <View
                        className="h-full rounded-full bg-sky-500 dark:bg-sky-400"
                        style={{ width: `${Math.max(2, getProgressValue(d.progress))}%` }}
                      />
                    </View>
                  )}
                  {d.phase === 'downloading' && (
                    <NouText className="text-sm text-sky-700 dark:text-sky-200 font-mono" numberOfLines={2}>
                      {d.progressLine || t('modals.starting')}
                    </NouText>
                  )}
                  {d.phase === 'done' && (
                    <View className="gap-2">
                      <View className="mt-1 flex-row items-center gap-2">
                        <View className="flex-row items-center gap-2 mr-auto">
                          <MaterialIcons name="check-circle" size={18} color={isDark ? '#86efac' : '#16a34a'} />
                          <NouText className="text-xs text-zinc-500 dark:text-zinc-400" numberOfLines={1}>
                            {isAndroid ? 'Saved to the Downloads folder' : t('modals.downloadComplete')}
                          </NouText>
                        </View>
                        {!!d.savedPath && !isAndroid && (
                          <Pressable
                            onPress={() => mainClient.openFolder(d.savedPath)}
                            className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                          >
                            <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                              {t('buttons.show')}
                            </NouText>
                          </Pressable>
                        )}
                        <Pressable
                          onPress={() => {
                            downloads$[dUrl].delete()
                          }}
                          className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                        >
                          <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {t('buttons.clear')}
                          </NouText>
                        </Pressable>
                      </View>
                    </View>
                  )}
                  {d.phase === 'error' && (
                    <View className="gap-2">
                      <NouText className="text-sm text-red-700 dark:text-red-300 font-medium">
                        {d.errorMsg || t('modals.downloadFailed')}
                      </NouText>
                      <View className="flex-row justify-end mt-1">
                        <Pressable
                          onPress={() => {
                            downloads$[dUrl].delete()
                          }}
                          className="bg-zinc-200 dark:bg-zinc-800 px-3 py-1.5 rounded-lg active:bg-zinc-300 dark:active:bg-zinc-700"
                        >
                          <NouText className="text-xs font-semibold text-zinc-700 dark:text-zinc-300">
                            {t('buttons.clear')}
                          </NouText>
                        </Pressable>
                      </View>
                    </View>
                  )}
                </View>
              )
            })}
          </View>
        )}
      </ScrollView>
    </BaseModal>
  )
}
