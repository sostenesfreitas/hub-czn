package com.hubczn.optimizer.logic

import com.hubczn.optimizer.capture.GestureDispatcher
import com.hubczn.optimizer.capture.MLKitOCREngine
import com.hubczn.optimizer.capture.ScreenshotManager
import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.model.OcrBlock

class MemoryFragmentScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    private val onProgress: (String) -> Unit = {}
) {
    private val fragments = mutableListOf<MemoryFragment>()
    private var idCounter = 1

    suspend fun scan(): List<MemoryFragment> {
        fragments.clear()
        idCounter = 1

        // First item is already open (user opened inventory and tapped first item)
        var consecutiveEmpty = 0

        while (true) {
            val bitmap = screenshotManager.capture() ?: break
            val blocks = ocrEngine.recognizeBlocks(bitmap)

            val fragment = parseFragment(blocks)
            if (fragment != null) {
                fragments.add(fragment)
                onProgress("Scanned ${fragments.size} fragments")
                consecutiveEmpty = 0
            } else {
                consecutiveEmpty++
                if (consecutiveEmpty >= 3) break
            }

            // Find ">" arrow to advance to next item
            // In the fragment detail, ">" appears at the right edge of the screen
            val nextArrow = blocks
                .filter { it.text == ">" && it.bounds.left > bitmap.width * 0.7f }
                .maxByOrNull { it.bounds.left }

            if (nextArrow == null) {
                // Try scrolling down in the inventory grid to load more items
                gestures.swipeUp(
                    x = bitmap.width / 2f,
                    fromY = bitmap.height * 0.7f,
                    toY = bitmap.height * 0.3f
                )
                // Re-capture after scroll to get fresh block positions
                val freshBitmap = screenshotManager.capture() ?: break
                val freshBlocks = ocrEngine.recognizeBlocks(freshBitmap)
                val firstItem = findFirstGridItem(freshBlocks)
                if (firstItem != null) {
                    gestures.tap(firstItem.first, firstItem.second)
                } else {
                    break
                }
            } else {
                gestures.tap(nextArrow.bounds.exactCenterX(), nextArrow.bounds.exactCenterY())
            }
        }

        onProgress("Done: ${fragments.size} fragments")
        return fragments
    }

    private fun parseFragment(blocks: List<OcrBlock>): MemoryFragment? {
        val rarityText = blocks.firstOrNull { FragmentParser.RARITY_MAP.containsKey(it.text) }?.text
            ?: return null
        val rarityNum = FragmentParser.parseRarity(rarityText)

        val slotText = blocks.firstOrNull { FragmentParser.SLOT_MAP.containsKey(it.text) }?.text
            ?: return null
        val slotNum = FragmentParser.parseSlot(slotText)

        val upgradeText = blocks.firstOrNull { it.text.matches(Regex("""\+\d+""")) }?.text ?: "+0"
        val level = FragmentParser.parseUpgradeLevel(upgradeText)

        // Set name is in "Set Effect" section — the line after the text "Set Effect"
        val setEffectIdx = blocks.indexOfFirst { it.text == "Set Effect" }
        val setName = if (setEffectIdx >= 0 && setEffectIdx + 1 < blocks.size)
            blocks[setEffectIdx + 1].text else ""

        // Fragment name is near the top of the panel, to the right of the item image
        val name = blocks.filter { it.bounds.top < 200 && it.bounds.left > 400 }
            .sortedBy { it.bounds.top }
            .firstOrNull()?.text ?: ""

        // Stats section: blocks between the stat area divider and "Set Effect"
        val statsBlocks = if (setEffectIdx >= 0) blocks.take(setEffectIdx) else blocks
        val statList = FragmentParser.parseStats(statsBlocks)

        if (statList.isEmpty()) return null

        return MemoryFragment(
            id = idCounter++,
            slotNum = slotNum,
            setName = setName,
            rarity = rarityText,
            rarityNum = rarityNum,
            level = level,
            statList = statList
        )
    }

    private fun findFirstGridItem(blocks: List<OcrBlock>): Pair<Float, Float>? {
        // After closing detail / scrolling, we're back at the grid
        // Tap the first slot visible — approximate by finding inventory item text blocks
        val gridItem = blocks.filter { it.bounds.top > 100 && it.bounds.left < 200 }
            .minByOrNull { it.bounds.top } ?: return null
        return Pair(gridItem.bounds.exactCenterX(), gridItem.bounds.exactCenterY())
    }
}
