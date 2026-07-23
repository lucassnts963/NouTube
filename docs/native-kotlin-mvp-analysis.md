# Análise aprofundada: MVP de app Android nativo (Kotlin) inspirado no NouTube

> **⚠️ Nota de correção da arquitetura (importante).** As seções abaixo (2–4)
> dissecam **como o NouTube funciona**: nele, o "player" é o player *web* do
> YouTube dentro da WebView, controlado por JS. Isso continua valendo como
> descrição do NouTube. **Mas o app que estamos construindo NÃO segue esse
> desenho.** A arquitetura-alvo deste projeto é:
>
> - **WebView** = só para **navegar** e **baixar** (yt-dlp). Não reproduz.
> - **Player nativo (ExoPlayer/Media3)** = o centro. Recebe um "link" e decide
>   como tocar: **arquivo baixado** (foco inicial) ou **link do YouTube via
>   streaming** (depois). Background + notificação são do Media3.
>
> Ou seja: o insight "o NouTube não tem player próprio" descreve o NouTube, e
> **aqui a decisão é justamente ter um player nativo próprio**, começando pela
> reprodução dos vídeos já baixados. A implementação em `../android-native/`
> segue a arquitetura corrigida; veja o README de lá.
>
> Objetivo original do documento: fundamentar a viabilidade em Kotlin nativo,
> reaproveitando as partes do NouTube que servem (download yt-dlp, WebView de
> navegação, MediaSession/notificação).

---

## 0. Veredito em uma frase

**É viável e o esforço é menor do que parece — porque o "player" que você
tentou construir não precisa existir.** O insight central do NouTube é que ele
**não implementa um player de vídeo**. Ele embute o player web do próprio
YouTube dentro de uma `WebView` e apenas o **controla remotamente** via
JavaScript. Todo o trabalho pesado (streaming adaptativo, decodificação,
DRM/throttling, seleção de qualidade) continua sendo feito pelo player nativo
do YouTube rodando na System WebView. É exatamente por isso que a performance é
boa — e é exatamente o oposto do que dá problema quando se constrói um player
próprio.

Se você internalizar esse ponto, o resto do projeto vira "plumbing" (encanamento)
bem delimitado.

---

## 1. O engano que causa o problema de performance

Quando se fala em "fazer meu próprio player para o YouTube", o caminho natural
é: extrair a URL de stream (via yt-dlp ou similar) e tocar em um `ExoPlayer` /
`Media3`. Isso tem custos altíssimos e é o que provavelmente te travou:

1. **Streams adaptativos separados (DASH)** — vídeo e áudio vêm em faixas
   separadas; você precisa muxar/sincronizar ou montar um MPD manualmente.
2. **URLs efêmeras e assinadas** — os links expiram e exigem decifrar a
   `signatureCipher`/`n-param` do YouTube, que muda com frequência (é um jogo de
   gato-e-rato; é justamente o que o yt-dlp mantém atualizado).
3. **Throttling** — sem o cálculo correto do parâmetro `n`, o YouTube limita a
   banda e o vídeo fica "buffering" eternamente. Sintoma clássico de player
   próprio "lento".
4. **Custo de manutenção** — cada quebra do YouTube vira um bug seu.

O NouTube **desvia de todos esses problemas** ao deixar o player web do YouTube
resolver isso. Você paga um preço diferente (depender do DOM/JS do YouTube), mas
performance de reprodução deixa de ser problema seu.

---

## 2. Como o NouTube realmente funciona (dissecção do código atual)

O app atual é React Native (Expo), mas **toda a lógica que importa está num
módulo nativo Kotlin** (`modules/nou-tube-view/android/...`) + um **bundle de
scripts de conteúdo** (`content/*.ts`, compilado para `assets/scripts/main.bjs`).
O React Native é só a casca de UI (abas, modais, configurações). Para um app
Kotlin nativo, **o RN some e essa casca é substituída por Activities/Compose**;
o miolo já é Kotlin e é reaproveitável quase inteiro.

São quatro camadas.

### Camada 1 — WebView wrapper (`NouTubeView.kt`)

Uma `WebView` customizada (`NouWebView`) configurada para se passar por um
navegador mobile e rodar o YouTube:

```kotlin
settings.run {
  javaScriptEnabled = true
  domStorageEnabled = true
  mediaPlaybackRequiresUserGesture = false   // deixa o áudio/vídeo iniciar sem toque
  builtInZoomControls = true
  displayZoomControls = false
}
CookieManager.getInstance().setAcceptCookie(true)  // login persistente
```

Responsabilidades-chave dessa camada:

- **User-Agent** definido para forçar o layout mobile (`m.youtube.com`).
- **`WebViewClient`**:
  - `onPageStarted` → **injeta o script** (`evaluateJavascript(scriptOnStart)`).
  - `shouldOverrideUrlLoading` → mantém navegação dentro de domínios
    YouTube/Google e abre o resto no navegador externo.
  - `shouldInterceptRequest` → **bloqueia hosts de anúncio/telemetria**
    (`BLOCK_HOSTS`) devolvendo resposta vazia — ad-block nível de rede.
  - `doUpdateVisitedHistory` → emite `onLoad(url)` para a UI reagir a mudanças
    de rota (SPA do YouTube).
- **`WebChromeClient`**:
  - `onShowCustomView`/`onHideCustomView` → **fullscreen real**: quando o player
    web pede fullscreen, a View de vídeo é adicionada ao `decorView`, esconde as
    barras de sistema e gerencia **orientação** (inclusive o caso chato de vídeo
    retrato x paisagem, com um `OrientationEventListener` dedicado para não
    ficar entrando/saindo de fullscreen em loop — ver comentários no código).
  - `onPermissionRequest` → mic/câmera (busca por voz).
- **`SwipeRefreshLayout`** com pull-to-refresh (desabilitado em `/watch` e
  `/shorts` para não atrapalhar o scrub do player).
- **Menu de contexto** "Copy link" em links.

Custo de reescrita nativa: **baixo/médio** — é uma `WebView` com clients
customizados. O fullscreen + orientação é a parte com mais casos de borda, mas
o código atual já resolveu e documentou os *gotchas*.

### Camada 2 — Injeção de JS/CSS e a ponte bidirecional

O coração da integração. O app injeta, a cada carregamento de página, um bundle
JS (`content/main.ts` → esbuild → `main.bjs`) precedido de um "prelude" com
configurações (`window.NouTubeInitialSettings`, etc.).

**Ponte JS → Kotlin** (`NouJsInterface.kt`, exposto como `window.NouTubeI`):

```kotlin
@JavascriptInterface fun onMessage(payload: String)                 // eventos genéricos (JSON)
@JavascriptInterface fun notify(title, author, seconds, thumbnail)  // metadados p/ notificação
@JavascriptInterface fun notifyProgress(playing: Boolean, pos: Long)// estado de reprodução (1x/s)
```

Do lado JS, `content/utils.ts`:

```ts
export function emit(type, data) {
  if (window.NouTubeI) window.NouTubeI.onMessage(JSON.stringify({ type, data }))
}
```

**Ponte Kotlin → JS**: simplesmente `webView.evaluateJavascript("NouTube.next()")`.

**O objeto `window.NouTube`** (`content/noutube.ts`) — a "cara" do player, mas
repare que **cada método só delega para o player nativo do YouTube**:

```ts
const getPlayer = () => document.getElementById('movie_player')   // <- o player É do YouTube
return {
  play:  () => getPlayer()?.playVideo(),
  pause: () => getPlayer()?.pauseVideo(),
  prev:  () => getPlayer()?.previousVideo(),
  next:  () => getPlayer()?.nextVideo(),
  seekBy:(d) => getPlayer()?.seekBy(d),
  getVideoUrl, getPlaybackRate, setPlaybackRate, setPlaybackQuality, ...
}
```

**`content/player.ts`** observa o `#movie_player` (via `MutationObserver`),
escuta `onStateChange` e, de forma *throttled*, empurra o estado para o Kotlin:

```ts
window.NouTubeI?.notify(title, author, duration, thumbUrl)          // ao trocar de vídeo
window.NouTubeI?.notifyProgress(el.getPlayerState() == 1, currentTime)  // ~1x/s
```

**`content/menu.ts`** injeta itens no menu "⋮" de cada vídeo — inclusive o
**"Download 🦦"** — que apenas emite um evento para o Kotlin:

```ts
downloadMenuItem.onclick = () => { if (url) emit('download', { url }) }
```

Ou seja: o "Download" da UI web não faz nada sozinho — ele avisa o nativo, que
abre o fluxo do yt-dlp (Camada 3).

Custo de reescrita nativa: **médio**. O JS injetado é reaproveitável quase
integralmente (é agnóstico de RN). Para o MVP dá para usar um **subconjunto
mínimo**: `noutube.ts` (objeto de controle) + `player.ts` (notify/progresso) +
`menu.ts` (item de download) + `utils.ts` (emit). Os módulos de blocklist,
sponsorblock, dislikes, tradução, mini-player etc. são *features* opcionais que
ficam de fora do MVP.

> ⚠️ **Fragilidade estrutural**: essa camada depende de detalhes internos do
> YouTube — o id `movie_player`, os métodos `playVideo/nextVideo`, os seletores
> de DOM do menu, o formato das respostas de `fetch`/XHR. **Quando o YouTube
> muda, quebra.** É o principal custo recorrente do projeto (ver §7).

### Camada 3 — Download via yt-dlp (`NouYtDlp.kt`)

Não é o binário CLI do yt-dlp rodando como processo. É a lib
**`io.github.junkfood02.youtubedl-android`** (`:library` + `:ffmpeg`), que
empacota um **Python + yt-dlp + FFmpeg** para Android e expõe uma API Kotlin. A
init é **pesada** (extrai o runtime para o disco) e por isso é **lazy** e
sincronizada:

```kotlin
YoutubeDL.getInstance().init(context)   // 1x, lazy, protegido por lock
FFmpeg.getInstance().init(context)
```

Fluxo:

1. **`listFormats(url)`** → `yt-dlp --dump-json --no-playlist` → parseia
   `formats[]` e monta **opções curadas** (Melhor qualidade / 1080p / 720p /
   Áudio / MP3) em vez de despejar 30 formatos crus no usuário.
2. **`downloadVideo(url, formatId, outputDir, onProgress)`**:
   - baixa para um tempdir no `cacheDir`;
   - vídeo: `-f <fmt> --merge-output-format mp4`;
   - MP3: `-f bestaudio/best --extract-audio --audio-format mp3 --add-metadata
     --embed-thumbnail`;
   - progresso via callback `(progress, eta, line)` → `sendEvent`;
   - ao terminar, **publica no MediaStore** (`Downloads/`) com
     `IS_PENDING`, respeitando o storage scoped do Android moderno.
3. **`update()`** — atualiza o yt-dlp em runtime (importante: o YouTube quebra o
   yt-dlp com frequência e o usuário precisa poder atualizar sem esperar release
   do app). Usa reflection para tolerar mudanças de assinatura da lib.

Custo de reescrita nativa: **muito baixo** — esse arquivo é **quase copy-paste**.
A única dependência com o resto é `nouController.t(...)` (i18n) e o `sendEvent`
do módulo Expo, que num app nativo viram, respectivamente, `context.getString`
e um callback/`Flow`.

### Camada 4 — Reprodução em background: MediaSession + notificação (`NouService.kt`)

Um **Foreground Service** (`foregroundServiceType="mediaPlayback"`) com
`MediaSessionCompat` + `NotificationCompat.MediaStyle`. É o que dá:

- **Notificação de mídia** com capa, título, autor e botões
  **⏮ prev / ⏯ play-pause / ⏭ next** + ações custom **⏪ Rewind(-10)** e
  **⏩ Forward(+30)**.
- **Controles de hardware/lockscreen/Bluetooth** via `MediaButtonReceiver`.
- **Pausar ao desconectar fone** (`ACTION_AUDIO_BECOMING_NOISY` / BT ACL).
- **Sleep timer**.

O ponto elegante — os callbacks da MediaSession **só reencaminham para o JS**:

```kotlin
override fun onSkipToNext()     { webView.evaluateJavascript("NouTube.next()", null) }
override fun onSkipToPrevious() { webView.evaluateJavascript("NouTube.prev()", null) }
override fun onPlay()           { webView.evaluateJavascript("NouTube.play()", null) }
```

E o estado da notificação é alimentado pelo `notify()`/`notifyProgress()` que o
`player.ts` empurra. **Loop completo fechado.**

Custo de reescrita nativa: **baixo** — código Android puro (não tem nada de RN).
Copia quase direto. Numa versão nova vale considerar **Media3
`MediaSession`** no lugar do `MediaSessionCompat` legado, mas para o MVP o
código atual funciona.

### Fluxo end-to-end: apertar "⏭" na notificação com a tela bloqueada

```
[Notificação ⏭] → MediaButtonReceiver → NouService.onSkipToNext()
   → webView.evaluateJavascript("NouTube.next()")
   → (JS) getPlayer().nextVideo()            // player web do YouTube troca de vídeo
   → (JS) player.ts detecta onStateChange + troca de videoId
   → window.NouTubeI.notify(novoTitulo, autor, duração, thumb)
   → NouService atualiza MediaSession + reconstrói a notificação
```

Nenhuma decodificação de vídeo passou pelo seu código. Você só orquestrou.

### Fluxo end-to-end: baixar um vídeo pelo menu da WebView

```
[⋮ do vídeo → "Download 🦦"] → (JS) emit('download', {url})
   → NouTubeI.onMessage → app nativo abre a folha de opções
   → listFormats(url)  (yt-dlp --dump-json)  → mostra Melhor/1080p/720p/Áudio/MP3
   → usuário escolhe → downloadVideo(url, fmt) → progresso na UI
   → publica em Downloads/ (MediaStore)
```

---

## 3. O que muda ao sair do React Native/Expo para Kotlin nativo

Boa notícia: **você está descartando a parte que não é o diferencial**. O RN
aqui é só orquestração de UI e a "cola" de eventos. Mapeamento do que sai/fica:

| Peça atual (RN/Expo)                     | No app Kotlin nativo                                   | Reaproveitamento |
|------------------------------------------|-------------------------------------------------------|------------------|
| `NouYtDlp.kt`                            | classe idêntica                                       | ~95% copy-paste  |
| `NouService.kt` (MediaSession/notif.)    | Service idêntico (ou migra p/ Media3)                 | ~90%             |
| `NouTubeView.kt` (WebView + clients)     | `WebView` numa Activity/Compose `AndroidView`         | ~80%             |
| `NouJsInterface.kt` (bridge)             | idêntico                                              | ~100%            |
| `content/*.ts` (JS injetado)             | **mesmo bundle** carregado de `assets/`               | ~90% (subconjunto)|
| `NouTubeViewModule.kt` (ponte Expo↔RN)   | **removido** — vira chamada direta de método/`Flow`   | descartado       |
| UI React (abas, modais, settings)        | **reescrita** em Jetpack Compose / Views              | reescrever       |
| `sendEvent`/`EventDispatcher` do Expo    | `StateFlow`/`SharedFlow`/callback                     | adaptar          |
| i18n `nouController.t()`                 | `context.getString(R.string.…)`                       | adaptar          |

Tradução do miolo: baixa. O grosso do trabalho novo é **a casca de UI** (que
você controla e é justamente onde estava sua dor com "player próprio" — que aqui
some).

---

## 4. Arquitetura proposta do MVP nativo

Projeto **Android nativo, 100% Kotlin, Jetpack Compose** (Views tradicionais
também servem; Compose só para a casca, o vídeo é WebView de qualquer forma).

```
app/
├─ MainActivity.kt              // hospeda a WebView (AndroidView) + UI Compose por cima
├─ webview/
│  ├─ NouWebView.kt             // WebView + WebViewClient + WebChromeClient (fullscreen)
│  ├─ NouJsInterface.kt         // @JavascriptInterface  (JS -> Kotlin)
│  └─ ScriptInjector.kt         // carrega assets/main.bjs + prelude, injeta no onPageStarted
├─ player/
│  └─ PlaybackService.kt        // Foreground Service + MediaSession + notificação
├─ download/
│  ├─ YtDlp.kt                  // = NouYtDlp.kt (listFormats/downloadVideo/update)
│  ├─ DownloadRepository.kt     // orquestra fila + progresso (StateFlow)
│  └─ FormatSheet.kt            // UI Compose da folha de opções de formato
├─ ui/
│  ├─ AddressBar / navegação mínima (back, reload, home YT/YT Music)
│  └─ DownloadsScreen.kt        // lista de downloads + progresso
└─ assets/
   └─ scripts/main.bjs          // bundle dos content scripts (reaproveitado)
```

**Dependências (Gradle):**

```groovy
implementation "io.github.junkfood02.youtubedl-android:library:0.17.3"
implementation "io.github.junkfood02.youtubedl-android:ffmpeg:0.17.3"
implementation "androidx.webkit:webkit:1.13.0"
implementation "androidx.media:media:1.7.0"          // ou androidx.media3:media3-session
implementation "androidx.swiperefreshlayout:swiperefreshlayout:1.1.0"
// Compose BOM, activity-compose, lifecycle, coroutines...
```

**Manifest essencial:**

```xml
<uses-permission android:name="android.permission.INTERNET"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE"/>
<uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK"/>
<uses-permission android:name="android.permission.POST_NOTIFICATIONS"/> <!-- Android 13+ -->

<service android:name=".player.PlaybackService"
         android:foregroundServiceType="mediaPlayback" android:exported="false">
  <intent-filter><action android:name="android.intent.action.MEDIA_BUTTON"/></intent-filter>
</service>
<receiver android:name="androidx.media.session.MediaButtonReceiver" android:exported="true">
  <intent-filter><action android:name="android.intent.action.MEDIA_BUTTON"/></intent-filter>
</receiver>
```

**minSdk sugerido 24+** (o módulo atual usa 21; a lib yt-dlp e políticas de FGS
modernas são mais tranquilas em 24+). targetSdk 34.

### Sobre os content scripts no MVP

Duas opções:

- **(A) Reusar o pipeline TS existente**: manter `content/*.ts` + esbuild e só
  copiar o `main.bjs` gerado para `app/src/main/assets/`. Prós: reaproveita
  tudo, inclusive futuras features. Contras: traz um passo de build JS ao
  projeto Android.
- **(B) MVP enxuto em um único `.js` escrito à mão** com só o essencial
  (`window.NouTube` de controle + observer do `movie_player` que chama
  `NouTubeI.notify/notifyProgress` + item "Download" no menu). Prós: zero
  toolchain JS, fácil de entender. Contras: reescreve o que já existe.

Recomendação para *testar viabilidade*: começar com **(B)** (um JS mínimo de
~150 linhas) para provar o loop completo rápido, e migrar para **(A)** quando
for agregar features. Assim o MVP não arrasta o build do NouTube inteiro.

---

## 5. Escopo do MVP (o que entra e o que fica de fora)

**Dentro (prova de viabilidade do loop completo):**

1. WebView abrindo `m.youtube.com` e `music.youtube.com`, com login persistente.
2. Injeção do JS mínimo + `window.NouTube` controlando o player web.
3. Fullscreen + orientação funcionando.
4. Foreground Service + notificação de mídia com **play/pause/next/previous**
   (+ rewind/forward) e reprodução em background/tela bloqueada.
5. Pausar ao tirar o fone.
6. Item **"Download"** no menu do vídeo → folha de formatos (`listFormats`) →
   `downloadVideo` com progresso → arquivo em `Downloads/`.
7. Botão de **atualizar yt-dlp**.

**Fora (v2+):** blocklist, SponsorBlock, dislikes, tradução de comentários,
mini-player, sleep timer avançado, fila/queue elaborada, temas, proxy,
importação de Takeout, sincronização, multi-abas. Tudo isso existe no NouTube e
pode ser portado depois — não é necessário para provar que a arquitetura serve.

---

## 6. Plano de implementação incremental (fases)

Cada fase é testável isoladamente — a ordem minimiza risco (as partes mais
incertas primeiro).

- **Fase 0 — Esqueleto**: projeto Compose vazio + `WebView` full-screen abrindo
  `m.youtube.com` com UA mobile e cookies. *Critério*: navego e assisto vídeo no
  WebView. (Risco: baixo)
- **Fase 1 — Ponte + controle**: `NouJsInterface` + JS mínimo com `window.NouTube`
  e observer do `movie_player`. *Critério*: `evaluateJavascript("NouTube.next()")`
  do Kotlin troca o vídeo; `notifyProgress` chega no Kotlin (log). (Risco: **médio**
  — é onde a fragilidade do DOM aparece.)
- **Fase 2 — Background/notificação**: `PlaybackService` + MediaSession +
  notificação; botões reencaminham para o JS. *Critério*: toco com a tela
  bloqueada e controlo pela notificação. (Risco: médio — políticas de FGS
  Android 13/14.)
- **Fase 3 — Fullscreen/orientação**: portar `onShowCustomView` + orientation
  listener. *Critério*: fullscreen de vídeo paisagem e retrato sem loop. (Risco:
  médio — muitos casos de borda, mas já resolvidos no código atual.)
- **Fase 4 — Download**: portar `YtDlp.kt` + folha de formatos + progresso +
  publish no MediaStore + botão de update. *Critério*: baixo 720p e MP3 e
  encontro em Downloads. (Risco: baixo, é copy-paste; init pesada é o cuidado.)
- **Fase 5 — Polimento MVP**: pausar-ao-tirar-fone, ad-block de rede
  (`BLOCK_HOSTS`), tratamento de erros e permissão de notificação.

Estimativa realista para um dev focado: **Fases 0–2 ≈ o "momento da verdade"**
(prova que a ideia funciona nativa) e cabem numa primeira leva; 3–5 são
incrementais.

---

## 7. Riscos e pontos críticos (leia antes de decidir)

1. **Fragilidade do DOM/JS do YouTube (risco recorrente nº 1).** Todo o controle
   depende de `#movie_player`, `playVideo/nextVideo`, seletores de menu e
   formatos de resposta. O YouTube muda sem aviso. *Mitigação*: isolar todos os
   seletores/nomes num único arquivo de "contrato", degradar com elegância
   (try/catch + logs), e manter o JS fácil de hotfix. É o mesmo custo que o
   NouTube paga.
2. **Manutenção do yt-dlp.** O YouTube quebra o yt-dlp periodicamente. *Mitigação*:
   o botão de `update()` em runtime é **essencial** (já existe). Mesmo assim,
   pode haver janelas de "quebrado até a lib atualizar".
3. **Políticas de Foreground Service (Android 13/14+).** `POST_NOTIFICATIONS`
   passou a ser runtime permission (13); `foregroundServiceType` obrigatório e
   regras mais rígidas de quando se pode iniciar FGS (14). *Mitigação*: iniciar o
   FGS a partir de contexto válido (durante reprodução), pedir a permissão de
   notificação no onboarding.
4. **WebView é a System WebView do aparelho.** Versões antigas/variações de
   fabricante podem se comportar diferente no fullscreen/áudio. *Mitigação*:
   testar em alguns aparelhos; `minSdk` 24+ ajuda.
5. **Política da Play Store / Termos do YouTube.** Apps que baixam conteúdo do
   YouTube e/ou "modificam" o YouTube tendem a violar os Termos de Serviço do
   YouTube e podem ser removidos da Play Store (o NouTube é distribuído fora da
   Play, ex.: F-Droid/flatpak/APK direto). *Implicação*: planeje distribuição
   **fora da Play Store** (APK/F-Droid) se o download for função central. Isso é
   decisão de produto, não técnica — mas precisa ser consciente.
6. **Licenciamento.** yt-dlp é **Unlicense**; a lib `youtubedl-android` e o
   FFmpeg empacotado têm licenças próprias (FFmpeg é LGPL/GPL conforme build). Se
   for distribuir, respeite as licenças (provável **GPL/copyleft** no conjunto).
   O NouTube tem flavors `full`/`foss` justamente para separar dependências
   proprietárias (ML Kit) das livres.
7. **Tamanho do APK.** O runtime Python + yt-dlp + FFmpeg **pesa** (dezenas de
   MB, multi-ABI). *Mitigação*: `abiFilters`/App Bundle por ABI.
8. **Init pesada do yt-dlp.** A primeira chamada extrai o runtime e trava se
   feita na main thread. *Mitigação*: já é lazy + em IO dispatcher; manter assim.

---

## 8. Recomendação e próximos passos

**Recomendo prosseguir**, com esta ordem:

1. **Provar o loop nativo (Fases 0–2) antes de qualquer polimento.** É o que
   responde de fato "isso funciona nativo sem player próprio?". Se as três
   primeiras fases funcionarem, o resto é execução conhecida.
2. Usar o **JS mínimo escrito à mão** (opção B) para o MVP, migrando para o
   bundle TS completo depois.
3. Portar `YtDlp.kt` e `NouService.kt` praticamente como estão — são o maior
   ganho por menor esforço.

### Decisões que preciso de você antes de escrever o código

- **Repositório**: crio o app nativo **dentro deste repo** (ex.: `android-native/`
  ou um novo módulo) ou é para começar um **projeto/repo separado**? (Misturar
  com o app RN existente pode confundir o build.)
- **UI**: **Jetpack Compose** (recomendo) ou Views/XML?
- **Content scripts**: começo com o **JS mínimo à mão** (recomendo p/ MVP) ou já
  quer reusar o bundle `content/*.ts` completo?
- **Media**: `MediaSessionCompat` (igual ao atual, porta rápido) ou já migrar
  para **Media3** (mais moderno, um pouco mais de trabalho)?
- **Distribuição**: você está ciente/ok de que o alvo realista é **fora da Play
  Store** (APK/F-Droid) por causa dos ToS do YouTube?

Respondendo isso, parto para o esqueleto (Fase 0) e vou entregando fase a fase.
```
