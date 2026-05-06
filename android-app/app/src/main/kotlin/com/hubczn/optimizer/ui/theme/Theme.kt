package com.hubczn.optimizer.ui.theme

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

private val DarkColors = darkColorScheme(
    primary = Color(0xFFE87A2D),
    onPrimary = Color.White,
    background = Color(0xFF1A1A2E),
    surface = Color(0xFF16213E),
    onSurface = Color.White
)

@Composable
fun CZNScannerTheme(content: @Composable () -> Unit) {
    MaterialTheme(colorScheme = DarkColors, content = content)
}
