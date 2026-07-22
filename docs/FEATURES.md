# Feature map

A reference of what already exists in the app versus what this fork added, so we
**reuse and extend instead of reinventing**. Verified against the codebase, not
memory. Keep it updated when features change.

The app is a privacy-focused wrapper around `m.youtube.com` / `music.youtube.com`
in an Android WebView (Expo/React Native), a desktop build (Electron), and a web
build. Most behavior is injected into the page by a **content bundle**
(`content/*` → built to `assets/scripts/main.bjs`).

## Already in the app (inherited from upstream NouTube)

### Content filtering / cleanup
| Feature | Where | Notes |
|---|---|---|
| **Blocklist — block channels & keywords** | `states/blocklist.ts`, `lib/blocklist.ts`, `content/blocklist.ts`, `components/modal/SettingsBlocklistContent.tsx` | Hides feed items whose channel/keyword matches. Has its own settings tab **and is synced**. This is the canonical "block bad content" tool. |
| **User styles (custom CSS) & user scripts (custom JS)** | `states/user-styles.ts`, `lib/user-styles.ts`, `content/css.ts`, `content/user-scripts.ts`, `SettingsUserStylesContent.tsx` | Builtins: `hide-mix-playlist`, `hide-shorts-navbar`, `hide-community-posts`. Synced. The canonical CSS-injection mechanism. |
| Hide Shorts | `settings.hideShorts`, `hideShortsInNavbar`, `content/css.ts` (`hideShorts()`) | Toggle + CSS. |
| Hide mix playlists | `settings.hideMixPlaylist` + user-style builtin | |
| SponsorBlock | `content/sponsorblock.ts` | Skips sponsor segments. |
| Clickbait thumbnails | `content/clickbait.ts` | |
| Return dislikes | `content/dislikes.ts`, `settings.showDislikes` | |
| Translate comments | `content/translate.ts`, `settings.translateComments` | |
| h264ify / prefer H.264 | `content/h264ify.ts`, `settings.preferH264` | |

### Library & data
| Feature | Where |
|---|---|
| Bookmarks (star pages) | `states/bookmarks.ts`, `BookmarkModal`, `LibraryModal` |
| Folders | `states/folders.ts`, `FolderModal` |
| Watch history | `states/history.ts`, `HistoryModal` |
| Queue | `states/queue.ts`, `QueueModal` |
| RSS feeds for channels | `states/feeds.ts`, `FeedModal`, `lib/feeder.ts` |

### Playback
| Feature | Where |
|---|---|
| Background playback + media notification | `modules/nou-tube-view` `NouService.kt` |
| Mini-player | `content/mini-player.ts`, `settings.miniPlayer` |
| Playback speed / quality | `PlaybackSpeedModal`, `PlaybackQualityModal` |
| Sleep timer | `states/sleep-timer.ts`, `SleepTimerModal` |
| Play original audio, pinch-zoom, live chat | `content/audio.ts`, `content/pinch.ts`, `content/livechat.ts` |

### Download / import / export
| Feature | Where | Notes |
|---|---|---|
| **Download a single video** (yt-dlp) | `modules/nou-tube-view` `NouYtDlp.kt` (`listFormats`/`downloadVideo`), desktop `desktop/src/main/lib/ytdlp.ts`, `ToolsModal` | |
| **Import from Google Takeout (CSV)** | `lib/import.ts` (`importCsv`, `importZip`) | Subscriptions/channels, playlists, music. **This already existed** — the fork only added history. |
| Import/export bookmarks list | `SettingsModalTabSettings.tsx` | |
| Cookie import, custom user-agent | `CookieModal`, `UserAgentModal` |

### Sync (Supabase)
| Feature | Where | Notes |
|---|---|---|
| Cloud sync of bookmarks/folders/settings/user-styles | `lib/supabase/*`, `states/sync-meta.ts` | Email magic-link auth; **gated on a non-free plan**; per-collection last-write-wins. Endpoint is env-configurable. |

### Misc
Tabs (`states/tabs.ts`), proxy (`settings.proxy*`), share, embed video, deep links, changelog.

## Added in this fork

| Feature | Branch | Reuse / overlap |
|---|---|---|
| Takeout **watch-history** import (JSON + HTML) | `feat/noutube-import-download` | **Extends** existing `lib/import.ts`. No duplication. |
| **Download a whole playlist** | `feat/noutube-import-download` | **Extends** existing yt-dlp `downloadVideo` (adds `listPlaylist`). |
| **Local player + library** (audio→music, video→video) with background | `feat/noutube-import-download` | New — no local player existed. `states/local-library.ts`, `states/player.ts`, `MediaPlayerModal`, `LocalLibraryModal`. Uses `expo-video`. |
| **System Picture-in-Picture** (local player + webview) | `feat/noutube-import-download` | New — native `enterPictureInPicture`/`setAutoPictureInPicture`. |
| **GuriTube rebrand** (name, elucas.dev tokens, icon, IBM Plex fonts) | `feat/guritube-rebrand` | New. Fork-only; kept off the upstream branch. |
| **Modo guri** (parental) — PIN lock, allow-list ("só isso aqui"), Restricted Mode, hide shorts/search/comments | `feat/modo-guri` | ⚠️ See overlap notes below. |
| **Self-host sync** — in-app server config, email login, `nou_profiles` premium gate, `nou_history` table, migrations + guide | `feat/self-host-sync` | **Extends** the existing Supabase sync. |

## Two intentional lanes (owner decision — do NOT merge)

Modo guri and the blocklist look adjacent but are **two deliberately separate
lanes**, for different users and opposite paradigms:

| | **Modo guri** | **Blocklist** |
|---|---|---|
| Paradigm | **Whitelist** (allow-only) | **Blacklist** (block-only) |
| Who | The kid / shared-device use — the child's mode | The owner's personal filtering |
| Trigger | PIN-locked; when ON, only allow-listed channels/playlists are reachable, plus the extra filters (hide shorts/search/comments) for more control | Always-on personal preference: content *you* don't want to see |
| Status | Fork-added (`states/guri.ts`, `content/guri.ts`) | Pre-existing, synced (`states/blocklist.ts`) |

The whitelist **is** the essence of modo guri; the blocklist stays as the
owner's own tool. **Do not fold one into the other** — that was an earlier idea
and it's rejected.

Minor, acceptable overlap: modo guri hides shorts/comments with its **own CSS**
in `content/guri.ts` rather than reusing the `user-styles` builtins. That's on
purpose — a PIN-locked parental mode must enforce independently of user-toggleable
builtins, so keeping its enforcement self-contained is correct. Only dedupe
selector strings if it ever causes drift.

## Branch topology

```
main                              ← upstream snapshot
└─ feat/noutube-import-download    ← 4 features, brand-free → upstream PR candidate
   └─ feat/guritube-rebrand        ← GuriTube identity (fork only)
      └─ feat/modo-guri            ← parental controls
         └─ feat/self-host-sync    ← self-hosted sync
            └─ docs/feature-map     ← this doc + AGENTS.md
```
