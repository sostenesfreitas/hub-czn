package com.hubczn.optimizer.logic

import com.hubczn.optimizer.capture.GestureDispatcher
import com.hubczn.optimizer.capture.MLKitOCREngine
import com.hubczn.optimizer.capture.ScreenshotManager
import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.model.OcrBlock
import kotlinx.coroutines.delay

/**
 * Walks the player's Memory Fragment INVENTORY by tapping the
 * calibrated `>` (next) arrow on the fragment-detail dialog. Each
 * iteration: capture → parse the currently-shown fragment → record
 * if new → tap next.
 *
 * Preconditions on entry:
 *  - The user has opened the inventory and tapped the FIRST fragment,
 *    so the detail dialog is showing fragment #1.
 *  - The user has calibrated the `>` button position (passed as
 *    [nextX] / [nextY]).
 *
 * Termination:
 *  - 3 consecutive iterations produce the same fragment signature (no
 *    advance happened — we wrapped or hit the end).
 *  - 5 consecutive parse failures.
 *  - MAX_ITERATIONS hard cap.
 *
 * Calibration coords are required: without them the scanner cannot
 * advance through the inventory.
 */
class MemoryFragmentScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    private val nextX: Float?,
    private val nextY: Float?,
    private val onProgress: (String) -> Unit = {},
) {

    companion object {
        private const val MAX_ITERATIONS = 5000  // huge inventories possible
        private const val ANIM_NEXT_MS = 350L
        private const val MAX_DUPLICATE_STREAK = 3
        private const val MAX_PARSE_FAILS = 5
    }

    suspend fun scan(): List<MemoryFragment> {
        if (nextX == null || nextY == null) {
            onProgress("Memory Fragments scan needs calibration: tap Calibrate first.")
            return emptyList()
        }

        val results = mutableListOf<MemoryFragment>()
        val seenSignatures = mutableSetOf<String>()
        var lastSignature: String? = null
        var duplicateStreak = 0
        var parseFails = 0

        for (iter in 0 until MAX_ITERATIONS) {
            val bmp = screenshotManager.capture() ?: break
            val blocks = ocrEngine.recognizeBlocks(bmp)

            // The fragment detail dialog occupies the right ~half of
            // the screen. Filter out the left thumbnail strip / row
            // of fragment thumbnails at the bottom so they don't
            // pollute the title-row detection.
            val rightPanel = blocks.filter { it.bounds.left > bmp.width * 0.30 && it.bounds.top < bmp.height * 0.85 }

            val frag = CombatantParser.parseFragmentPanel(rightPanel, slotNum = 0, equippedCharName = "")

            // Diagnostic: when a Legendary fragment ends up with fewer
            // than 5 stat entries (1 main + 4 substats), dump the right-
            // panel block list so we can see which row was lost.
            if (frag != null && frag.rarityNum >= 5 && frag.statList.size < 5) {
                val all = rightPanel.joinToString(" | ") { b ->
                    "'${b.text.trim()}'@(${b.bounds.left},${b.bounds.top},${b.bounds.right},${b.bounds.bottom})"
                }
                val parsed = frag.statList.joinToString(", ") { s ->
                    "${s.stat}=${s.value}${if (s.type == "percent") "%" else ""}"
                }
                onProgress("  iter $iter SHORT statList (${frag.statList.size}/5) ${frag.setName} +${frag.level}. parsed=[$parsed]. rightPanel=[$all]")
            }

            if (frag == null) {
                parseFails++
                onProgress("  parse fail $parseFails/$MAX_PARSE_FAILS at iter $iter")
                if (parseFails >= MAX_PARSE_FAILS) {
                    onProgress("Stopping: $MAX_PARSE_FAILS consecutive parse failures.")
                    break
                }
                gestures.tap(nextX, nextY)
                delay(ANIM_NEXT_MS)
                continue
            }
            parseFails = 0

            // We now have the fragment's set + level + rarity + stats.
            // The slot_num came back as 0 (we passed 0 since we're
            // scanning inventory rather than a per-slot tap). Re-derive
            // it from the Roman numeral that should be visible on the
            // detail dialog (the slot icon at top-left of the panel).
            val slotNum = blocks.firstNotNullOfOrNull {
                FragmentParser.parseSlot(it.text).takeIf { s -> s in 1..6 }
            } ?: frag.slotNum

            val correctedFrag = frag.copy(slotNum = slotNum)

            val sig = signature(correctedFrag)
            if (sig in seenSignatures) {
                duplicateStreak++
                onProgress("  duplicate ($duplicateStreak/$MAX_DUPLICATE_STREAK): ${correctedFrag.setName} ${correctedFrag.rarity} +${correctedFrag.level}")
                if (duplicateStreak >= MAX_DUPLICATE_STREAK) {
                    onProgress("Done: $MAX_DUPLICATE_STREAK consecutive duplicates (total ${results.size}).")
                    break
                }
            } else {
                duplicateStreak = 0
                seenSignatures.add(sig)
                results.add(correctedFrag.copy(id = results.size + 1))
                onProgress("Captured ${results.size}: slot ${correctedFrag.slotNum} ${correctedFrag.setName} ${correctedFrag.rarity} +${correctedFrag.level}")
            }

            // Also bail if the panel didn't change at all (signature
            // match + duplicate streak handles wrap; this guards the
            // case where the first hit IS already a duplicate of a
            // recent one).
            if (sig == lastSignature) {
                duplicateStreak++
                if (duplicateStreak >= MAX_DUPLICATE_STREAK) {
                    onProgress("Done: panel stuck on the same fragment ${MAX_DUPLICATE_STREAK}× (total ${results.size}).")
                    break
                }
            }
            lastSignature = sig

            gestures.tap(nextX, nextY)
            delay(ANIM_NEXT_MS)
        }
        onProgress("Done: ${results.size} fragments")
        return results
    }

    /**
     * Identity of an inventory fragment for dedup purposes. Fragments
     * are unique when (slot, set, rarity, level, full statlist) match.
     */
    private fun signature(f: MemoryFragment): String = buildString {
        append(f.slotNum); append('|')
        append(f.setName); append('|')
        append(f.rarity); append('|')
        append(f.level)
        for (s in f.statList) {
            append('|'); append(s.stat); append(':')
            append(s.type); append(':'); append(s.value); append(':'); append(s.extraRolls)
        }
    }
}
