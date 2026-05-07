package com.hubczn.optimizer.logic

import com.hubczn.optimizer.capture.GestureDispatcher
import com.hubczn.optimizer.capture.MLKitOCREngine
import com.hubczn.optimizer.capture.ScreenshotManager
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.MemoryFragment
import kotlinx.coroutines.delay

/**
 * Walks the combatant roster on the left edge of the combatant detail
 * screen, capturing Stats values and the 6 equipped Memory Fragments per
 * combatant. Output is a list of fully populated Combatant objects with
 * embedded fragment lists.
 *
 * Preconditions on entry:
 *  - Game is on the combatant detail screen of any combatant.
 *  - Stats tab is selected (the right panel shows Attack/Defense/...).
 *  - Floating overlay is visible.
 *
 * Termination:
 *  - Same combatant name read twice in a row immediately after a
 *    roster swipe (slider hit the bottom).
 *  - 5 consecutive iterations failed to produce a parseable Combatant.
 *  - Iteration count >= MAX_ITERATIONS (hard cap).
 */
class CombatantScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    private val rosterX: Float = 40f,        // calib_combatants_x default
    private val firstThumbnailY: Float = 200f, // calib_combatants_y default
    private val onProgress: (String) -> Unit = {}
) {

    companion object {
        private const val MAX_ITERATIONS = 100
        private const val THUMB_PITCH_PX = 80
        private const val ANIM_PANEL_MS = 600L  // tab / page change
        private const val ANIM_SLOT_MS = 400L   // slot select
    }

    private val results = mutableListOf<Combatant>()

    suspend fun scan(): List<Combatant> {
        results.clear()
        var thumbY = firstThumbnailY
        var lastName: String? = null
        var consecutiveFails = 0
        var swipedThisIter = false

        for (iter in 0 until MAX_ITERATIONS) {
            // 1. Read combatant Stats panel.
            val stats = readStats()
            if (stats == null) {
                consecutiveFails++
                if (consecutiveFails >= 5) {
                    onProgress("Stopping: 5 consecutive stat-read failures.")
                    return results
                }
                val (advY, advSwiped) = advanceRoster(thumbY)
                thumbY = advY
                swipedThisIter = advSwiped
                continue
            }

            // 2. Detect end-of-roster: same name twice immediately after a swipe.
            if (stats.name == lastName && swipedThisIter) {
                onProgress("Done: end of roster (name '${stats.name}' repeated after swipe).")
                return results
            }

            // 3. Read fragments.
            val fragments = readEquippedFragments(stats.name)
            results.add(stats.copy(equippedFragments = fragments))
            onProgress("Captured ${results.size}: ${stats.name} (+${fragments.size} fragments)")

            lastName = stats.name
            consecutiveFails = 0

            // 4. Move on.
            val (nextY, swiped) = advanceRoster(thumbY + THUMB_PITCH_PX)
            thumbY = nextY
            swipedThisIter = swiped
        }

        onProgress("Stopping: hit MAX_ITERATIONS=$MAX_ITERATIONS.")
        return results
    }

    /** Captures the Stats screen and parses it. Does NOT navigate. */
    private suspend fun readStats(): Combatant? {
        val bmp = screenshotManager.capture() ?: return null
        val blocks = ocrEngine.recognizeBlocks(bmp)
        return CombatantParser.parseStats(blocks)
    }

    /**
     * Navigates Stats -> Memory Fragments, taps each available slot, OCRs
     * the right panel, then navigates back to Stats. Returns the list of
     * fragments that parsed successfully (skips empty / unparseable slots).
     */
    private suspend fun readEquippedFragments(charName: String): List<MemoryFragment> {
        // Tap "Memory Fragments" tab.
        val tabsBmp = screenshotManager.capture() ?: return emptyList()
        val tabsBlocks = ocrEngine.recognizeBlocks(tabsBmp)
        val mfTab = CombatantSidebar.findTab(tabsBlocks, "Memory Fragments")
            ?: run {
                onProgress("Could not find 'Memory Fragments' tab.")
                return emptyList()
            }
        gestures.tap(mfTab.first, mfTab.second)
        delay(ANIM_PANEL_MS)

        // OCR the page once to find the 6 slot icons.
        val pageBmp = screenshotManager.capture() ?: return emptyList()
        val pageBlocks = ocrEngine.recognizeBlocks(pageBmp)
        val slotTargets = CombatantSidebar.findSlotTapTargets(pageBlocks)
        if (slotTargets.isEmpty()) {
            onProgress("No slot numerals found on Memory Fragments page.")
        }

        val collected = mutableListOf<MemoryFragment>()
        for (slot in 1..6) {
            val target = slotTargets[slot] ?: continue
            gestures.tap(target.first, target.second)
            delay(ANIM_SLOT_MS)
            val panelBmp = screenshotManager.capture() ?: continue
            val panelBlocks = ocrEngine.recognizeBlocks(panelBmp)
            // Filter to the right ~30% of the screen to reduce false matches.
            val rightPanel = panelBlocks.filter {
                it.bounds.left > panelBmp.width * 0.65
            }
            val frag = CombatantParser.parseFragmentPanel(rightPanel, slot, charName)
            if (frag != null) collected.add(frag)
        }

        // Navigate back to Stats so the next iteration can re-read stats.
        val backBmp = screenshotManager.capture() ?: return collected
        val backBlocks = ocrEngine.recognizeBlocks(backBmp)
        val statsTab = CombatantSidebar.findTab(backBlocks, "Stats")
        if (statsTab != null) {
            gestures.tap(statsTab.first, statsTab.second)
            delay(ANIM_PANEL_MS)
        }
        return collected
    }

    /**
     * Taps the next thumbnail in the vertical roster. If [nextY] is past
     * the visible area, swipes the roster up first and returns the reset
     * Y coordinate. Returns the actually-tapped Y and a flag indicating
     * whether a swipe was performed in this call.
     */
    private suspend fun advanceRoster(nextY: Float): Pair<Float, Boolean> {
        val bmp = screenshotManager.capture() ?: return nextY to false
        val maxVisibleY = bmp.height * 0.85f
        var y = nextY
        var swiped = false
        if (y > maxVisibleY) {
            gestures.swipeUp(
                x = rosterX,
                fromY = bmp.height * 0.80f,
                toY = bmp.height * 0.20f
            )
            delay(ANIM_PANEL_MS)
            y = firstThumbnailY
            swiped = true
        }
        gestures.tap(rosterX, y)
        delay(ANIM_PANEL_MS)
        return y to swiped
    }
}
