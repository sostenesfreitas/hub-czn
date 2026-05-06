package com.hubczn.optimizer.logic

import com.hubczn.optimizer.capture.GestureDispatcher
import com.hubczn.optimizer.capture.MLKitOCREngine
import com.hubczn.optimizer.capture.ScreenshotManager
import com.hubczn.optimizer.model.Combatant

class CombatantScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    private val onProgress: (String) -> Unit = {}
) {
    private val combatants = mutableListOf<Combatant>()

    suspend fun scan(): List<Combatant> {
        combatants.clear()

        var consecutiveNewCount = 0
        var charIndex = 0
        val seenNames = mutableSetOf<String>()

        // Scan characters by tapping each thumbnail position, scrolling when needed
        while (true) {
            val thumbnailY = getThumbnailY(charIndex)
            val rosterBitmap = screenshotManager.capture() ?: break
            val rosterBlocks = ocrEngine.recognizeBlocks(rosterBitmap)

            // Check if this thumbnail position is still within the visible list
            // by looking for sidebar content at this Y position
            val hasThumbnailHere = rosterBlocks.any {
                it.bounds.left < 80 && kotlin.math.abs(it.bounds.top - thumbnailY) < 50
            }

            if (!hasThumbnailHere) {
                // Scroll the character list down and reset index to first visible position
                gestures.swipeUp(x = 40f, fromY = rosterBitmap.height * 0.8f, toY = rosterBitmap.height * 0.2f)
                val afterScrollBitmap = screenshotManager.capture() ?: break
                val afterScrollBlocks = ocrEngine.recognizeBlocks(afterScrollBitmap)
                val hasAnySidebar = afterScrollBlocks.any { it.bounds.left < 80 }
                if (!hasAnySidebar) break  // no more characters
                charIndex = 0
                consecutiveNewCount = 0
                continue
            }

            gestures.tap(x = 40f, y = thumbnailY.toFloat())

            // Navigate to Stats tab
            val detailBitmap = screenshotManager.capture() ?: continue
            val detailBlocks = ocrEngine.recognizeBlocks(detailBitmap)
            val statsTab = detailBlocks.firstOrNull { it.text == "Stats" }
            if (statsTab != null) {
                gestures.tap(statsTab.bounds.exactCenterX(), statsTab.bounds.exactCenterY())
            }

            val statsBitmap = screenshotManager.capture() ?: continue
            val statsBlocks = ocrEngine.recognizeBlocks(statsBitmap)
            val combatant = CombatantParser.parseStats(statsBlocks)

            if (combatant != null && combatant.name !in seenNames) {
                seenNames.add(combatant.name)
                combatants.add(combatant)
                onProgress("Scanned ${combatants.size}: ${combatant.name}")
                consecutiveNewCount = 0
            } else {
                consecutiveNewCount++
                if (consecutiveNewCount >= 5) break  // 5 consecutive known/failed = done
            }

            // Navigate back to roster
            val backBitmap = screenshotManager.capture() ?: continue
            val backBlocks = ocrEngine.recognizeBlocks(backBitmap)
            val backButton = backBlocks.firstOrNull { it.text == "◀" || it.text == "<" }
            if (backButton != null) {
                gestures.tap(backButton.bounds.exactCenterX(), backButton.bounds.exactCenterY())
            }

            charIndex++
        }

        onProgress("Done: ${combatants.size} combatants")
        return combatants
    }

    private fun getThumbnailY(index: Int): Int {
        // Thumbnails start at ~200px top, each is ~80px tall
        return 200 + index * 80
    }
}
