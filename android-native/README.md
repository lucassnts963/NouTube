# NouTube Native (MVP)

App Android **100% Kotlin / Jetpack Compose**, standalone (Gradle próprio,
independente do app React Native na raiz deste repositório).

## Arquitetura (correta)

Dois mundos separados:

- **WebView** — só para **navegar** no YouTube/YT Music e **baixar** (yt-dlp).
  Injeta um script mínimo (`assets/nou.js`) que só adiciona um botão ⬇ e reporta
  a URL do vídeo para o Kotlin. **Não reproduz nada de forma central.**
- **Player nativo** — um **ExoPlayer (Media3)** de verdade, tela nativa, que é o
  centro do app. Ele recebe um "link" e **decide como tocar**:
  - **arquivo baixado** (local) → **foco inicial deste MVP**;
  - **link do YouTube** (streaming) → resolução do stream via yt-dlp — próximo passo.
  Background, notificação de mídia (prev/play/next), audio focus e pausar-ao-tirar-fone
  vêm do Media3.

Fluxo: navego na WebView → baixo → o arquivo aparece na **Biblioteca** → toco no
**player nativo** (com notificação e background).

> A análise técnica completa está em
> [`../docs/native-kotlin-mvp-analysis.md`](../docs/native-kotlin-mvp-analysis.md)
> (com a nota de correção da arquitetura no topo).

## Como abrir/rodar

Este esqueleto **não inclui o `gradle-wrapper.jar` nem os scripts `gradlew`**
(não dá para versionar bem o binário aqui). Para buildar:

1. Abra a pasta `android-native/` no **Android Studio** (Giraffe+) — ele baixa o
   Gradle 8.9 sozinho. Ou, com Gradle instalado:
   ```bash
   cd android-native && gradle wrapper --gradle-version 8.9 && ./gradlew assembleDebug
   ```
2. `local.properties` com `sdk.dir=/caminho/para/Android/sdk` (o Android Studio cria).
3. Rode em **dispositivo físico**.

## Estado por fase

| Fase | Escopo | Estado |
|------|--------|--------|
| A | **Player nativo ExoPlayer tocando arquivos baixados** + background + notificação | ✅ foco deste MVP |
| B | Biblioteca dos downloads (lista via MediaStore) | ✅ |
| C | WebView (navegar) + download via yt-dlp (formatos, progresso, MediaStore) | ✅ |
| D | Fullscreen/orientação da WebView | ✅ básico |
| E | Player tocando **link do YouTube** (streaming via yt-dlp) | ⏳ próximo passo |
| F | Fila/playlist, capa/metadados nos downloads, sleep timer | ⏳ |

## Mapa dos arquivos

```
player/PlaybackService.kt    ExoPlayer + MediaSession (background + notificação)  ← o player
player/LibraryRepository.kt  lista os downloads a partir do MediaStore
player/WebViewBridge.kt      ponte JS->Kotlin: só "baixe esta URL"
download/YtDlp.kt            wrapper yt-dlp (listFormats/downloadVideo/update)
download/DownloadRepository.kt  orquestra a fila + estado p/ a UI
webview/NouWebView.kt        WebView (navegar) + ad-block de rede
webview/NouChromeClient.kt   fullscreen + orientação
webview/NouJsInterface.kt    recebe o clique do botão ⬇
assets/nou.js                injeta só o botão ⬇ nas páginas de vídeo
ui/AppUi.kt                  Biblioteca (PlayerView + lista) + Navegar (WebView) + picker
MainActivity.kt              conecta o MediaController ao PlaybackService e faz o wiring
```

## Próximo passo natural (Fase E — tocar link do YouTube no player nativo)

O player já é um ExoPlayer; falta o "resolvedor de fonte" para links do YouTube:
`yt-dlp` extrai a(s) URL(s) de stream. Duas rotas:

- **Progressivo** (`-f 18/22`): uma URL única → `MediaItem.fromUri(streamUrl)`.
  Simples, mas limitado a ~360/720p.
- **DASH** (vídeo+áudio separados, até 4K): duas URLs → `MergingMediaSource`
  (vídeo) + (áudio) no ExoPlayer. É a rota completa; as URLs expiram, então
  resolver na hora de tocar.

Para **áudio em background** (caso comum de YT Music), resolver só `bestaudio` e
tocar a faixa de áudio é a rota mais limpa e barata.

## Ressalvas honestas (não foi compilado/rodado aqui)

- **Sem SDK Android neste ambiente** — não compilei. Espere pequenos ajustes de
  API ao abrir no Android Studio (fixei tudo em `media3 1.4.1`).
- `download/YtDlp.kt` `update()` usa reflection de propósito (a assinatura de
  `updateYoutubeDL` muda entre versões da lib).
- A **Biblioteca** lê o MediaStore Downloads apenas das entradas que o próprio
  app criou (não precisa de permissão de storage para isso).
- **Distribuição**: alvo realista **fora da Play Store** (APK/F-Droid) pelos
  Termos do YouTube; licenças (yt-dlp/ffmpeg) implicam provável copyleft.
```
