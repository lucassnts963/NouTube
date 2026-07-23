package dev.elucas.noutube.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.statusBarsPadding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.verticalScroll
import androidx.compose.material.icons.Icons
import androidx.compose.material.icons.filled.Download
import androidx.compose.material.icons.filled.Home
import androidx.compose.material.icons.filled.MusicNote
import androidx.compose.material.icons.filled.Refresh
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LinearProgressIndicator
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import dev.elucas.noutube.download.DownloadRepository
import dev.elucas.noutube.download.YtDlp

/**
 * Thin overlay drawn on top of the WebView: quick nav (YouTube / YT Music /
 * downloads / update yt-dlp) plus the download format picker and progress list.
 * Everything reads from [DownloadRepository]'s flows.
 */
@Composable
fun NouOverlay(
    onHome: () -> Unit,
    onMusic: () -> Unit,
) {
    val probing by DownloadRepository.probing.collectAsStateWithLifecycle()
    val request by DownloadRepository.pendingRequest.collectAsStateWithLifecycle()
    val downloads by DownloadRepository.downloads.collectAsStateWithLifecycle()
    val error by DownloadRepository.error.collectAsStateWithLifecycle()

    var showDownloads by remember { mutableStateOf(false) }
    var updating by remember { mutableStateOf(false) }

    Row(
        modifier = Modifier
            .statusBarsPadding()
            .padding(horizontal = 4.dp),
        horizontalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        OverlayButton(Icons.Filled.Home, "YouTube", onHome)
        OverlayButton(Icons.Filled.MusicNote, "YouTube Music", onMusic)
        OverlayButton(Icons.Filled.Download, "Downloads") { showDownloads = true }
        OverlayButton(Icons.Filled.Refresh, "Atualizar yt-dlp") {
            updating = true
            DownloadRepository.updateYtDlp { updating = false }
        }
    }

    if (probing != null) {
        AlertDialog(
            onDismissRequest = { },
            confirmButton = {},
            title = { Text("Analisando vídeo…") },
            text = {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    CircularProgressIndicator(Modifier.padding(end = 12.dp))
                    Text("Buscando formatos disponíveis")
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

    error?.let { msg ->
        AlertDialog(
            onDismissRequest = { DownloadRepository.clearError() },
            confirmButton = { TextButton(onClick = { DownloadRepository.clearError() }) { Text("OK") } },
            title = { Text("Erro") },
            text = { Text(msg) },
        )
    }

    if (showDownloads) {
        AlertDialog(
            onDismissRequest = { showDownloads = false },
            confirmButton = { TextButton(onClick = { showDownloads = false }) { Text("Fechar") } },
            title = { Text(if (updating) "Atualizando yt-dlp…" else "Downloads") },
            text = {
                if (downloads.isEmpty()) {
                    Text("Nenhum download ainda. Toque no botão ⬇ num vídeo.")
                } else {
                    Column(Modifier.verticalScroll(rememberScrollState())) {
                        downloads.forEach { d ->
                            Column(Modifier.fillMaxWidth().padding(vertical = 6.dp)) {
                                Text(d.title.ifBlank { d.url }, maxLines = 1)
                                LinearProgressIndicator(
                                    progress = { (d.progress / 100f).coerceIn(0f, 1f) },
                                    modifier = Modifier.fillMaxWidth().padding(vertical = 4.dp),
                                )
                                Text(
                                    when (d.status) {
                                        DownloadRepository.Status.DONE -> "Concluído"
                                        DownloadRepository.Status.ERROR -> "Erro: ${d.line}"
                                        else -> d.line.ifBlank { "${d.progress.toInt()}%" }
                                    },
                                    color = Color.Gray,
                                )
                            }
                        }
                    }
                }
            },
        )
    }
}

@Composable
private fun OverlayButton(
    icon: androidx.compose.ui.graphics.vector.ImageVector,
    contentDescription: String,
    onClick: () -> Unit,
) {
    IconButton(onClick = onClick) {
        Icon(icon, contentDescription = contentDescription, tint = Color.White)
    }
}
