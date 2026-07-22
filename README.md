# GuriTube

Android and Desktop app for YouTube and YouTube Music, with a focus on a safer,
family-friendly experience.

GuriTube is a fork of [NouTube](https://github.com/nonbili/NouTube) by Nonbili
Inc. It keeps the lightweight YouTube / YouTube Music wrapper and adds features
for managing your own library and — going forward — parental controls
(**modo guri**).

## Features

- No ads
- Plays in the background
- Manage video/music library without login
- Manage watch history without login
- Import history, subscriptions and playlists from Google Takeout
- Download a single video or a whole playlist
- Built-in player for downloaded files (music player for audio, video player for
  video) with background playback
- Picture-in-Picture for the player and the YouTube webview
- RSS feed reader for YouTube channels
- Hide shorts
- Live chat
- Play original audio
- Customize with CSS

## Roadmap

- **Modo guri** — parental controls: PIN-locked settings, forced Restricted
  Mode, a channel/playlist allow-list ("only this"), daily time limits, and
  hiding search/recommendations.
- Additional wrappers beyond YouTube (the "Guri TV" direction).

## How it works

- Wrap https://m.youtube.com and https://music.youtube.com in an Android webview
- Inject code to block ads
- Hook playback controls and support playing in background

## Credits

Built on top of [NouTube](https://github.com/nonbili/NouTube). Huge thanks to
the original authors — please consider supporting their work.

## Note

We're not affiliated with YouTube or any .org websites.
