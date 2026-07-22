# AGENTS.md

Guidance for AI agents (and humans) working in this repo. This is **GuriTube**, a
privacy-focused fork of [NouTube](https://github.com/nonbili/NouTube): a wrapper
around `m.youtube.com` / `music.youtube.com` in an Android WebView (Expo/React
Native), with desktop (Electron) and web builds.

## Rule #0 — audit before you build

This is a **mature app with many features already**. Before implementing
anything, check whether it already exists and **reuse/extend** it instead of
reinventing:

1. Read [`docs/FEATURES.md`](docs/FEATURES.md) — the feature map.
2. Grep the relevant areas: `states/` (data), `content/` (page behavior),
   `components/modal/` (UI), `settings.ts` (toggles), `lib/`.
3. Prefer extending an existing module over adding a parallel one.

Examples of the trap: content filtering already exists as the **blocklist**
(channels/keywords) and **user-styles** (CSS builtins) — don't write new
hide-this CSS without checking those first. Takeout CSV import already exists in
`lib/import.ts` — extend it, don't recreate it.

## Architecture

- **App shell**: Expo Router (`app/`), React Native + `react-native-web`.
  UI in `components/`, state in `states/` (Legend-State observables), helpers in
  `lib/`.
- **Injected content bundle**: `content/*.ts` is bundled with `bun bundle` into
  `assets/scripts/main.bjs` (git-ignored) and injected into the WebView. This is
  where page behavior lives (ad-block, blocklist, guri, css, player hooks…). The
  RN side pushes config into the page via `window.NouTube*` globals + a
  `window.NouTube.set*` bridge (see `content/noutube.ts` and
  `MainPageContent` `buildPrelude`).
- **Native module**: `modules/nou-tube-view/` (Kotlin) — the WebView, background
  `NouService`, yt-dlp (`NouYtDlp.kt`), PiP, Takeout zip extraction. Exposed to
  JS via `NouTubeViewModule`.
- **Desktop**: `desktop/` (Electron); mirrors native capabilities over IPC
  (`desktop/src/main/ipc/main.ts`).
- **Sync**: `lib/supabase/*` against an env/settings-configurable Supabase; RLS
  keyed on `auth.uid() = user_id`. Schema lives in `supabase/migrations/`.

## Build / test / lint

```bash
bun install
bun bundle          # rebuild the injected content bundle (needed after content/*)
bun test            # bun:test unit tests
bun run lint        # expo lint (eslint) — keep at 0 errors
```

- **You usually cannot build/run the Android APK or a device here.** Native
  (Kotlin), `expo-video`, `expo-camera`, PiP, and injected DOM behavior can only
  be verified on a real build/device. Flag anything unverified.
- After changing `content/*`, run `bun bundle` to confirm it compiles. `main.bjs`
  is git-ignored — the app build regenerates it.
- Type-check noise: a bare `tsc` reports hundreds of `className`/`No overload`
  errors because NativeWind's JSX types aren't loaded standalone. Filter those
  out; only non-`className` errors are real.

## Conventions

- **Text & fonts**: always render text with `components/NouText`, never bare
  `<Text>` — it maps Tailwind weight/mono classes to the loaded IBM Plex family.
- **Styling**: NativeWind (Tailwind). Brand tokens in `tailwind.config.js`:
  dark base + single red accent `bg-primary` (`#E5484D`), `bg-accent-tint`,
  `text-accent-soft`, etc. Red is for actions/signals only.
- **Platform files**: `foo.native.ts(x)` / `foo.ts` / `foo.web.ts` split — put
  native-only deps (MMKV, expo-video, expo-camera) behind `.native` with a web
  stub. `expo-video`/`expo-camera` are native-only.
- **State**: Legend-State `observable<Store>({...})`. Persist per platform:
  MMKV on native, IndexedDB plugin on web (see `states/history.ts`,
  `states/local-library.ts` for the pattern). `react-native-mmkv` is **v4**:
  use `createMMKV({ id })` and `.remove(key)` (not `new MMKV()` / `.delete`).
- **i18n**: `t('key', 'English fallback')`. Fallbacks mean missing keys don't
  break; still add real strings to `locales/en.json` + `locales/pt_BR.json`
  (other locales via Weblate). UI copy is Brazilian Portuguese first.
- **Shared logic for the content bundle**: keep pure/testable logic in `lib/*`
  (dependency-free) so `content/*` can import it (see `lib/guri.ts`,
  `lib/user-styles.ts`, `lib/blocklist.ts`).
- **Sync**: never change the `noutube` URL scheme (wired to the auth deep link).
  Sync stays gated on a non-free `plan` (premium product); plan comes from
  `nou_profiles`.

## Branch & git

- Branch names: `feat/<slug>`, `docs/<slug>`, `chore/<slug>` (short, no noise).
- **`feat/noutube-import-download` stays brand-free** — it's the clean
  upstream-PR candidate. GuriTube branding and fork-only features stack on top
  (`feat/guritube-rebrand` → `feat/modo-guri` → `feat/self-host-sync`). See the
  topology in `docs/FEATURES.md`.
- Commit/push only when asked. Keep tests + lint green before committing.

## Known TODOs / overlaps

See the "Overlap / consolidation notes" in `docs/FEATURES.md`. Short version:
modo guri should compose the existing **blocklist** + **user-styles** rather than
carry parallel CSS; the allow-list is the part that stays unique to modo guri.
