package com.hubczn.optimizer.logic

import com.hubczn.optimizer.model.OcrBlock

/** Pure helpers for locating UI elements on the combatant detail screen. */
object CombatantSidebar {

    /**
     * Returns the tap target (centerX, centerY) of the sidebar tab whose
     * exact text matches [label] (e.g. "Stats", "Memory Fragments"), or
     * null if not found.
     */
    fun findTab(blocks: List<OcrBlock>, label: String): Pair<Float, Float>? {
        val b = blocks.firstOrNull { it.text.trim() == label } ?: return null
        return b.bounds.exactCenterX() to b.bounds.exactCenterY()
    }

    /**
     * Returns a map of slotNum (1..6) to tap target (centerX, centerY) for
     * each Roman-numeral slot label found on the Memory Fragments page.
     * Slots not present in OCR are absent from the result.
     */
    fun findSlotTapTargets(blocks: List<OcrBlock>): Map<Int, Pair<Float, Float>> {
        val result = mutableMapOf<Int, Pair<Float, Float>>()
        for (b in blocks) {
            val slot = FragmentParser.parseSlot(b.text)
            if (slot in 1..6 && slot !in result) {
                result[slot] = b.bounds.exactCenterX() to b.bounds.exactCenterY()
            }
        }
        return result
    }
}
