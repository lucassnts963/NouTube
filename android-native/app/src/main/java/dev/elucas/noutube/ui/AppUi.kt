package dev.elucas.noutube.ui

import android.net.Uri
import android.view.View
import android.view.ViewGroup
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.PlayArrow
import androidx.compose.material.icons.filled.Public
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material.icons.filled.VideoLibrary
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.compose.ui.viewinterop.AndroidView
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import androidx.media3.common.Player
import androidx.media3.ui.PlayerView
import dev.elucas.noutube.download.DownloadRepository
import dev.elucas.noutube.download.YtDlp
import dev.elucas.noutube.player.LibraryRepository

private enum class Tab { LIBRARY, BROWSE }

/**
 * App shell: two destinations.
 *  - Biblioteca: the native ExoPlayer (PlayerView) + list of downloaded files.
 *  - Navegar: the WebView to find videos and download them.
 */
@Composable
fun MainScreen(
    player: Player?,
    onPlay: (Uri) -> Unit,
    onUpdateYtDlp: () -> Unit,
    onRefreshLibrary: () -> Unit,
    webView: View,
) {
    var tab by remember { mutableStateOf(Tab.LIBRARY) }

    // When a download finishes, refresh the library so it shows up.
    val downloads by DownloadRepository.downloads.collectAsStateWithLifecycle()
    val doneCount = downloads.count { it.status == DownloadRepository.Status.DONE }
    LaunchedEffect(doneCount) { if (doneCount > 0) onRefreshLibrary() }

    Scaffold(
        bottomBar = {
            NavigationBar {
                NavigationBarItem(
                    selected = tab == Tab.LIBRARY,
                    onClick = { tab = Tab.LIBRARY },
                    icon = { Icon(Icons.Filled.VideoLibrary, null) },
                    label = { Text("Biblioteca") },
                )
                NavigationBarItem(
                    selected = tab == Tab.BROWSE,
                    onClick = { tab = Tab.BROWSE },
                    icon = { Icon(Icons.Filled.Public, null) },
                    label = { Text("Navegar") },
                )
            }
        },
    ) { padding ->
        Box(Modifier.fillMaxSize().padding(padding)) {
            when (tab) {
                Tab.LIBRARY -> LibraryScreen(player, onPlay, onUpdateYtDlp, onRefreshLibrary)
                Tab.BROWSE -> BrowseScreen(webView)
            }
        }
    }
}

@Composable
private fun LibraryScreen(
    player: Player?,
    onPlay: (Uri) -> Unit,
    onUpdateYtDlp: () -> Unit,
    onRefreshLibrary: () -> Unit,
) {
    val items by LibraryRepository.items.collectAsStateWithLifecycle()

    Column(Modifier.fillMaxSize()) {
        if (player?.currentMediaItem != null) {
            AndroidView(
                modifier = Modifier.fillMaxWidth().aspectRatio(16f / 9f).background(Color.Black),
                factory = { ctx ->
                    PlayerView(ctx).apply {
                        useController = true
                        this.player = player
                    }
                },
                update = { it.player = player },
            )
        }

        Row(
            Modifier.fillMaxWidth().padding(horizontal = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.SpaceBetween,
        ) {
            Text("Downloads", Modifier.padding(vertical = 8.dp))
            Row {
                IconButton(onClick = onRefreshLibrary) {
                    Icon(Icons.Filled.Refresh, "Atualizar biblioteca")
                }
                TextButton(onClick = onUpdateYtDlp) { Text("Atualizar yt-dlp") }
            }
        }

        if (items.isEmpty()) {
            Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                Text("Nenhum download ainda.\nUse a aba Navegar e o botão ⬇ num vídeo.")
            }
        } else {
            LazyColumn(Modifier.fillMaxSize()) {
                items(items, key = { it.uri }) { item ->
                    Row(
                        Modifier.fillMaxWidth().clickable { onPlay(item.uri) }.padding(12.dp),
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        Icon(
                            if (item.isAudio) Icons.Filled.MusicNote else Icons.Filled.PlayArrow,
                            null,
                            Modifier.padding(end = 12.dp),
                        )
                        Text(item.name, maxLines = 2)
                    }
                }
            }
        }
    }
}

@Composable
private fun BrowseScreen(webView: View) {
    Box(Modifier.fillMaxSize()) {
        AndroidView(
            modifier = Modifier.fillMaxSize(),
            factory = {
                (webView.parent as? ViewGroup)?.removeView(webView)
                webView
            },
        )
        DownloadDialogs()
    }
}

/** Format picker + download progress + errors, all driven by DownloadRepository. */
@Composable
private fun DownloadDialogs() {
    val probing by DownloadRepository.probing.collectAsStateWithLifecycle()
    val request by DownloadRepository.pendingRequest.collectAsStateWithLifecycle()
    val downloads by DownloadRepository.downloads.collectAsStateWithLifecycle()
    val error by DownloadRepository.error.collectAsStateWithLifecycle()

    if (probing != null) {
        AlertDialog(
            onDismissRequest = {},
            confirmButton = {},
            title = { Text("Analisando vídeo…") },
            text = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.padding(end = 12.dp))
                    Text("Buscando formatos")
                }
            },
        )
    }

    request?.let { req ->
        AlertDialog(
            onDismissRequest = { DownloadRepository.dismissRequest() },
            confirmButton = {
                TextButton(onClick = { DownloadRepository.dismissRequest() }) { Text("Cancelar") }
            },
            title = { Text(req.title.ifBlank { "Baixar vídeo" }) },
            text = {
                Column {
                    req.options.forEach { option: YtDlp.FormatOption ->
                        TextButton(
                            onClick = { DownloadRepository.pick(option) },
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            Column(Modifier.fillMaxWidth()) {
                                Text(option.label)
                                Text(option.description, color = Color.Gray)
                            }
                        }
                    }
                }
            },
        )
    }

    val active = downloads.filter { it.status == DownloadRepository.Status.RUNNING || it.status == DownloadRepository.Status.PENDING }
    if (active.isNotEmpty()) {
        Column(Modifier.fillMaxWidth().padding(12.dp)) {
            active.forEach { d ->
                Text(d.title.ifBlank { d.url }, maxLines = 1)
                LinearProgressIndicator(
                    progress = { (d.progress / 100f).coerceIn(0f, 1f) },
                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                )
            }
        }
    }

    error?.let { msg ->
        AlertDialog(
            onDismissRequest = { DownloadRepository.clearError() },
            confirmButton = { TextButton(onClick = { DownloadRepository.clearError() }) { Text("OK") } },
            title = { Text("Erro") },
            text = { Text(msg) },
        )
    }
}
