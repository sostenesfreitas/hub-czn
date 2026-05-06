package com.hubczn.optimizer.ui.components

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp

data class ScanSummary(
    val fragmentsCount: Int = 0,
    val rescueCount: Int = 0,
    val combatantsCount: Int = 0,
    val exportedFiles: List<String> = emptyList()
)

@Composable
fun ResultsScreen(
    summary: ScanSummary,
    onExport: () -> Unit,
    onRescan: () -> Unit
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp)
    ) {
        Text("Capture Complete", style = MaterialTheme.typography.headlineMedium)

        if (summary.fragmentsCount > 0)
            Text("Memory Fragments: ${summary.fragmentsCount} pieces")
        if (summary.rescueCount > 0)
            Text("Rescue Records: ${summary.rescueCount} pulls")
        if (summary.combatantsCount > 0)
            Text("Combatants: ${summary.combatantsCount} characters")

        summary.exportedFiles.forEach { Text(it, style = MaterialTheme.typography.labelSmall) }

        Spacer(Modifier.weight(1f))

        Button(onClick = onExport, modifier = Modifier.fillMaxWidth()) {
            Text("Export JSON")
        }
        OutlinedButton(onClick = onRescan, modifier = Modifier.fillMaxWidth()) {
            Text("Scan Again")
        }
    }
}
