package com.hubczn.optimizer.logic

import com.hubczn.optimizer.capture.GestureDispatcher
import com.hubczn.optimizer.capture.MLKitOCREngine
import com.hubczn.optimizer.capture.ScreenshotManager
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.OcrBlock

class CombatantScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    private val onProgress: (String) -> Unit = {}
) {
    private val combatants = mutableListOf<Combatant>()

    suspend fun scan(): List<Combatant> {
        combatants.clear()

        // User is on the character roster. Scan the list of character thumbnails.
        // Characters appear as a vertical list on the left sidebar.
        val bitmap = screenshotManager.capture() ?: return emptyList()
        val characterCount = estimateCharacterCount(ocrEngine.recognizeBlocks(bitmap), bitmap.height)

        for (index in 0 until characterCount) {
            val rosterBitmap = screenshotManager.capture() ?: break
            val rosterBlocks = ocrEngine.recognizeBlocks(rosterBitmap)

            // Tap the Nth character thumbnail in the left list
            val thumbnailY = getThumbnailY(rosterBitmap.height, index)
            gestures.tap(x = 40f, y = thumbnailY)

            // Now on character detail — navigate to Stats tab
            val detailBitmap = screenshotManager.capture() ?: continue
            val detailBlocks = ocrEngine.recognizeBlocks(detailBitmap)
            val statsTab = detailBlocks.firstOrNull { it.text == "Stats" }
            if (statsTab != null) {
                gestures.tap(statsTab.bounds.exactCenterX(), statsTab.bounds.exactCenterY())
            }

            val statsBitmap = screenshotManager.capture() ?: continue
            val statsBlocks = ocrEngine.recognizeBlocks(statsBitmap)
            val combatant = CombatantParser.parseStats(statsBlocks)

            if (combatant != null) {
                combatants.add(combatant)
                onProgress("Scanned ${combatants.size}: ${combatant.name}")
            }

            // Navigate back to roster list
            val backButton = ocrEngine.recognizeBlocks(screenshotManager.capture() ?: continue)
                .firstOrNull { it.text == "◀" || it.text == "<" }
            if (backButton != null) {
                gestures.tap(backButton.bounds.exactCenterX(), backButton.bounds.exactCenterY())
            }
        }

        onProgress("Done: ${combatants.size} combatants")
        return combatants
    }

    private fun estimateCharacterCount(blocks: List<OcrBlock>, screenHeight: Int): Int {
        // Left sidebar thumbnails span from ~top to ~bottom of screen
        // Estimate ~80px per thumbnail
        val sidebarBlocks = blocks.filter { it.bounds.right < 100 }
        return if (sidebarBlocks.isNotEmpty()) sidebarBlocks.size.coerceAtMost(20) else 12
    }

    private fun getThumbnailY(screenHeight: Int, index: Int): Float {
        // Thumbnails start at ~200px top, each is ~80px tall
        return 200f + index * 80f
    }
}
