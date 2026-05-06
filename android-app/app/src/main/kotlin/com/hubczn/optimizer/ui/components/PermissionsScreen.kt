package com.hubczn.optimizer.ui.components

import android.content.Context
import android.content.Intent
import android.net.Uri
import android.provider.Settings
import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.unit.dp

data class PermissionItem(
    val label: String,
    val granted: Boolean,
    val onRequest: (Context) -> Unit
)

@Composable
fun PermissionsScreen(
    permissions: List<PermissionItem>,
    onStartScanner: () -> Unit
) {
    val context = LocalContext.current
    val allGranted = permissions.all { it.granted }

    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("CZN Scanner", style = MaterialTheme.typography.headlineMedium)
        Text("Grant the following permissions to begin:", style = MaterialTheme.typography.bodyMedium)

        permissions.forEach { perm ->
            Row(
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(12.dp)
            ) {
                Text(if (perm.granted) "✅" else "⬜")
                Text(perm.label, modifier = Modifier.weight(1f))
                if (!perm.granted) {
                    TextButton(onClick = { perm.onRequest(context) }) { Text("Grant") }
                }
            }
        }

        Spacer(Modifier.weight(1f))

        Button(
            onClick = onStartScanner,
            enabled = allGranted,
            modifier = Modifier.fillMaxWidth()
        ) {
            Text("Start Scanner")
        }
    }
}
