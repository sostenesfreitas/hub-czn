package com.hubczn.optimizer.logic

import com.hubczn.optimizer.model.OcrBlock

/** Pure helpers for locating UI elements on the combatant detail screen. */
object CombatantSidebar {

    /**
     * Stable mapping from the slot's TYPE label (a unique English word
     * shown right below each slot icon on the Memory Fragments page) to
     * its 1..6 slot number. These labels are full words and OCR them
     * reliably, unlike the Roman numerals (especially "I", which is a
     * single vertical stroke that ML Kit often misses).
     */
    val SLOT_TYPE_LABELS = mapOf(
        "Shock" to 1,
        "Suppression" to 2,
        "Denial" to 3,
        "Ideal" to 4,
        "Desire" to 5,
        "Imagination" to 6
    )

    /** Vertical offset (px) above the type label where the slot icon center sits. */
    private const val LABEL_TO_ICON_OFFSET = 70

    /**
     * Match window for associating a "+N" upgrade badge with a slot's
     * icon center. Sized generously: across DPIs (Galaxy Z Fold is much
     * wider than baseline) the badge can sit 130+ px to either side of
     * the icon centre and well below it. False-positive risk is bounded
     * because the only other "+N"-shaped text on this screen is the
     * Set-Effect description, which is filtered separately by the `%`
     * exclusion in [findSlotTapTargets].
     */
    private const val FILL_BADGE_X_TOL = 150
    private const val FILL_BADGE_Y_ABOVE = 60
    private const val FILL_BADGE_Y_BELOW = 200

    /**
     * Matches the upgrade badge as a PREFIX of the OCR'd block text.
     * The badge is rendered as "+N" followed by a tiny set-icon glyph; ML
     * Kit sometimes merges them into one block ("+5 X", "+10 ", or
     * with trailing whitespace), and a strict full-match regex would
     * reject those — leading us to flag a filled slot as empty and skip
     * its capture. We anchor at the start and accept anything after the
     * digits, but reject `%` (which would match Set-Effect strings like
     * "+25% Critical Damage" if a slot tap target sits near the right
     * panel boundary).
     */
    private val PLUS_LEVEL_REGEX = Regex("""^\+\d+""")

    /**
     * A slot's tap target plus its fill-state evidence.
     *
     * - [badgeDetected] is the strong POSITIVE signal: a "+N" upgrade
     *   badge was OCR'd within the small window around the icon
     *   center. Only filled slots render this badge, so this being
     *   true is high-confidence evidence the slot is filled.
     * - [filled] is the gate-decision: tap the slot iff this is true.
     *   It is true when [badgeDetected] OR when no big centered Roman
     *   numeral is detected (which would otherwise indicate an empty
     *   slot). The default is "tap" (filled=true) when neither signal
     *   fires, so badge-OCR misses don't silently drop real fragments.
     *
     * Downstream code uses [badgeDetected] (NOT [filled]) when ranking
     * duplicate fragments in the cross-combatant dedup pass: a record
     * built from a default-filled tap is much weaker evidence than a
     * record from a slot whose badge was actually OCR'd.
     */
    data class SlotTarget(
        val x: Float,
        val y: Float,
        val filled: Boolean,
        val badgeDetected: Boolean
    )

    /**
     * Roman-numeral block height above which the slot is treated as
     * empty (numeral is rendering centered-and-large inside the slot
     * circle). Filled slots place the numeral as a small badge at the
     * top of the circle, well below this height.
     */
    private const val EMPTY_NUMERAL_MIN_HEIGHT = 60

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
     * Returns a map of slotNum (1..6) to [SlotTarget] for each slot found
     * on the Memory Fragments page.
     *
     * Primary detection: TYPE LABEL (Shock/Suppression/Denial/Ideal/Desire/Imagination).
     * Tap target is offset upward by [LABEL_TO_ICON_OFFSET] to land on the slot
     * icon above the label.
     *
     * Fallback detection: Roman numeral (I-VI) via [FragmentParser.parseSlot].
     * Tap target is the numeral itself. Used only when the type label was
     * not OCR'd for that slot.
     *
     * `filled` is true when a "+N" upgrade badge sits within a small
     * window around the icon center; false when the slot is empty (only
     * the Roman numeral is visible inside the circle, no badge). Callers
     * MUST honour `filled = false` and skip the tap — tapping an empty
     * slot leaves the previous slot's data on the right panel and pollutes
     * the parsed result.
     *
     * Slots not present in OCR are absent from the result.
     */
    fun findSlotTapTargets(blocks: List<OcrBlock>): Map<Int, SlotTarget> {
        val plusBadges = blocks.filter { b ->
            val t = b.text.trim()
            PLUS_LEVEL_REGEX.containsMatchIn(t) && !t.contains('%')
        }
        // Big-numeral signal: a Roman numeral block taller than the
        // EMPTY_NUMERAL_MIN_HEIGHT threshold means the numeral is
        // rendered centered and large (empty slot). This is a NEGATIVE
        // signal: when present at a slot, the slot is empty.
        val bigNumeralSlots: Set<Int> = blocks.mapNotNull { b ->
            val s = FragmentParser.parseSlot(b.text)
            if (s in 1..6 && b.bounds.height() >= EMPTY_NUMERAL_MIN_HEIGHT) s else null
        }.toSet()

        fun hasBadgeNear(x: Float, y: Float): Boolean = plusBadges.any { b ->
            val bx = b.bounds.exactCenterX()
            val by = b.bounds.exactCenterY()
            kotlin.math.abs(bx - x) < FILL_BADGE_X_TOL &&
                by > y - FILL_BADGE_Y_ABOVE &&
                by < y + FILL_BADGE_Y_BELOW
        }

        fun makeTarget(slot: Int, x: Float, y: Float): SlotTarget {
            val badge = hasBadgeNear(x, y)
            val emptyByNumeral = slot in bigNumeralSlots && !badge
            val filled = badge || !emptyByNumeral
            return SlotTarget(x, y, filled = filled, badgeDetected = badge)
        }

        val result = mutableMapOf<Int, SlotTarget>()
        // First pass: type labels (preferred — whole-word OCR).
        for (b in blocks) {
            val slot = SLOT_TYPE_LABELS[b.text.trim()]
            if (slot != null && slot !in result) {
                val iconY = (b.bounds.top - LABEL_TO_ICON_OFFSET).toFloat().coerceAtLeast(0f)
                val iconX = b.bounds.exactCenterX()
                result[slot] = makeTarget(slot, iconX, iconY)
            }
        }
        // Second pass: Roman numerals fill any slot the labels missed.
        for (b in blocks) {
            val slot = FragmentParser.parseSlot(b.text)
            if (slot in 1..6 && slot !in result) {
                val x = b.bounds.exactCenterX()
                val y = b.bounds.exactCenterY()
                result[slot] = makeTarget(slot, x, y)
            }
        }
        return result
    }
}
