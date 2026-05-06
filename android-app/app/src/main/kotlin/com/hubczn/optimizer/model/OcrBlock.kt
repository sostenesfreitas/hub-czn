package com.hubczn.optimizer.model

import android.graphics.Rect

data class OcrBlock(
    val text: String,
    val bounds: Rect
)
