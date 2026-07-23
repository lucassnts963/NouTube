# NouTube Native (MVP)

App Android **100% Kotlin / Jetpack Compose**, standalone (Gradle próprio,
independente do app React Native na raiz deste repositório). Prova de viabilidade
da abordagem do NouTube feita de forma nativa:

> **WebView** envolvendo `m.youtube.com` / `music.youtube.com`, injetando um
> script que **controla o player web do próprio YouTube** (não construímos player);
> **Media3** para a notificação de mídia (play/pause/next/previous em background);
> **yt-dlp** (via youtubedl-android) para download direto do vídeo aberto.

A fundamentação técnica completa está em [`../docs/native-kotlin-mvp-analysis.md`](../docs/native-kotlin-mvp-analysis.md).

## Como abrir/rodar

Este esqueleto **não inclui o binário `gradle-wrapper.jar` nem os scripts
`gradlew`** (não dá para versionar bem o binário aqui). Para buildar:

1. Abra a pasta `android-native/` no **Android Studio** (Giraffe+). Ele detecta o
   projeto e baixa o Gradle 8.9 automaticamente. **OU**, com Gradle instalado:
   ```bash
   cd android-native && gradle wrapper --gradle-version 8.9 && ./gradlew assembleDebug
   ```
2. Crie `local.properties` com o caminho do SDK (o Android Studio faz isso):
   ```
   sdk.dir=/caminho/para/Android/sdk
   ```
3. Rode em um **dispositivo físico** (o runtime do yt-dlp e a reprodução de vídeo
   se comportam melhor em hardware real que no emulador).

## Estado por fase (ver plano no doc de análise)

| Fase | Escopo | Estado |
|------|--------|--------|
| 0 | WebView full-screen abrindo YouTube (UA mobile, cookies, background audio) | ✅ implementado |
| 1 | Ponte JS↔Kotlin + `window.NouTube` + observer do `movie_player` | ✅ implementado (`assets/nou.js`, `NouJsInterface`) |
| 2 | Media3 `SimpleBasePlayer` + `MediaSessionService` (notificação prev/play/next) | ✅ implementado |
| 3 | Fullscreen + orientação | ✅ básico (`NouChromeClient`) |
| 4 | Download via yt-dlp (formatos, progresso, MediaStore, update) | ✅ implementado (`YtDlp`, `DownloadRepository`) |
| 5 | Polimento (pausar-ao-tirar-fone, tratamento de erro) | ⏳ parcial |

## Mapa dos arquivos

```
webview/NouWebView.kt      WebView + WebViewClient (injeta script, ad-block de rede)
webview/NouChromeClient.kt fullscreen + orientação
webview/NouJsInterface.kt  ponte JS -> Kotlin (window.NouTubeI)
webview/ScriptInjector.kt  carrega assets/nou.js
assets/nou.js              script injetado: window.NouTube + notify/progress + botão download
player/WebViewLink.kt      estado + comandos compartilhados (WebView <-> Media3)
player/WebViewPlayer.kt    SimpleBasePlayer que faz a ponte p/ o player web
player/PlaybackService.kt  MediaSessionService (notificação automática)
download/YtDlp.kt          wrapper yt-dlp (listFormats/downloadVideo/update)
download/DownloadRepository.kt  orquestra a fila + estado p/ a UI
ui/NouOverlay.kt           overlay Compose (nav + picker de formato + downloads)
MainActivity.kt            wiring de tudo
```

## Ressalvas honestas (não foi compilado/rodado neste ambiente)

- **Não compilei nem testei em dispositivo** — foi escrito sem SDK Android
  disponível. Espere pequenos ajustes de API ao abrir no Android Studio,
  especialmente em:
  - `player/WebViewPlayer.kt` — o `SimpleBasePlayer` do Media3 é `@UnstableApi`
    e sua API tem detalhes por versão (fixei em `media3 1.4.1`). O truque dos
    "vizinhos fantasma" (playlist de 3 itens) é o que faz os botões prev/next da
    notificação dispararem — verifique esse comportamento na primeira execução.
  - `download/YtDlp.kt` — `update()` usa reflection de propósito, pois a
    assinatura de `updateYoutubeDL` muda entre versões da lib.
- **Fase 1 depende do DOM/JS interno do YouTube** (`#movie_player`, `playVideo`,
  `getPlayerResponse`, etc.). É o ponto naturalmente frágil; pode precisar de
  ajuste fino no aparelho conforme o YouTube muda. Todos os acessos estão
  embrulhados em `safe()` para degradar sem quebrar.
- **Botão de download**: no MVP é um **botão flutuante ⬇** nas páginas `/watch`
  (bem mais robusto que clonar o menu "⋮" do YouTube). O item de menu por vídeo
  pode ser portado depois de `content/menu.ts` do app RN.
- **Distribuição**: alvo realista é **fora da Play Store** (APK/F-Droid) pelos
  Termos do YouTube. Licenças (yt-dlp/ffmpeg) implicam provável copyleft no
  conjunto distribuído.
