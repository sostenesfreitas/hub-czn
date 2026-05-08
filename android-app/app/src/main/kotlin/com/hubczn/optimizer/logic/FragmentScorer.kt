package com.hubczn.optimizer.logic

import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.model.StatEntry

/**
 * Per-fragment gear scoring + per-substat efficiency, mirroring the
 * desktop's logic in `api/models/memory_fragment.py` and the
 * grade thresholds in `src/pages/combatants/CombatantDetail.tsx`:
 *
 *   gear_score = round(sum(value / max_roll) over substats * 10, 1)
 *   efficiency = value / (max_roll * roll_count)   // per-roll
 *   roll_count = extra_rolls + 1                    // OCR field
 *
 * Max-roll values come from `api/game_data/constants.py STATS`.
 */
object FragmentScorer {

    /**
     * Per-roll maximum value for a substat, keyed by (OCR stat name,
     * type). The OCR returns long English names ("Attack", "Critical
     * Damage", "Extra Damage", "Damage over time", "Ego Recovery"); the
     * type discriminates "Flat ATK" (8.0) from "ATK%" (1.3) etc.
     *
     * Values mirror the `STATS` table in
     * `api/game_data/constants.py` (4th tuple element).
     */
    private val MAX_ROLL: Map<Pair<String, String>, Double> = mapOf(
        ("Attack"           to "flat")    to 8.0,
        ("Attack"           to "percent") to 1.3,
        ("Defense"          to "flat")    to 5.0,
        ("Defense"          to "percent") to 1.3,
        ("Health"           to "flat")    to 12.0,
        ("Health"           to "percent") to 1.3,
        ("Critical Chance"  to "percent") to 2.0,
        ("Critical Damage"  to "percent") to 4.0,
        ("Ego"              to "flat")    to 5.0,
        ("Ego Recovery"     to "flat")    to 5.0,
        ("Damage over time" to "percent") to 3.4,
        ("Extra Damage"     to "percent") to 3.4,
        // Elemental damage main stats (slot V only). Per-roll max
        // mirrors STATS in api/game_data/constants.py (3.5 for substat
        // rolls; main-stat values are fixed by upgrade level).
        ("Passion Damage"   to "percent") to 3.5,
        ("Order Damage"     to "percent") to 3.5,
        ("Justice Damage"   to "percent") to 3.5,
        ("Void Damage"      to "percent") to 3.5,
        ("Instinct Damage"  to "percent") to 3.5,
    )

    /** Per-roll max for [stat]; null if the (name,type) is unknown. */
    fun maxRoll(stat: StatEntry): Double? = MAX_ROLL[stat.stat to stat.type]

    /**
     * Per-roll efficiency in [0..1+]. Returns null when the substat is
     * unknown (max-roll missing). roll_count is `extra_rolls + 1`.
     * A value > 1.0 is technically possible if the game allowed an
     * over-cap roll; we return it raw — the UI clamps to 100% on
     * display.
     */
    fun efficiency(stat: StatEntry): Double? {
        val max = maxRoll(stat) ?: return null
        val rollCount = stat.extraRolls + 1
        if (max <= 0 || rollCount <= 0) return null
        return stat.value / (max * rollCount)
    }

    /**
     * Gear score for a single fragment. Sums `value / max_roll` over
     * all SUBSTATS (the main stat is excluded — it is fixed by slot
     * type and not part of the score), multiplies by 10, rounds to 1
     * decimal place. Returns 0.0 for fragments with no parseable
     * substats.
     */
    fun gearScore(fragment: MemoryFragment): Double {
        // statList[0] is the main stat (slot 0); 1..4 are substats.
        val substats = fragment.statList.drop(1)
        if (substats.isEmpty()) return 0.0
        var sum = 0.0
        for (s in substats) {
            val max = maxRoll(s) ?: continue
            sum += s.value / max
        }
        return Math.round(sum * 10.0 * 10.0) / 10.0  // round to 0.1
    }

    /**
     * Average gear score over all equipped fragments on a combatant.
     * Used as the headline "GS" number in the row.
     */
    fun averageGearScore(fragments: List<MemoryFragment>): Double {
        if (fragments.isEmpty()) return 0.0
        val sum = fragments.sumOf { gearScore(it) }
        return Math.round(sum / fragments.size * 10.0) / 10.0
    }

    /** Letter grade thresholds, mirrored from desktop CombatantDetail.tsx. */
    data class Grade(val label: String, val argbColor: Int)

    fun grade(score: Double): Grade? = when {
        score >= 65 -> Grade("SSS", 0xFFFFD700.toInt())  // gold
        score >= 60 -> Grade("SS+", 0xFFFF9D00.toInt())  // amber
        score >= 55 -> Grade("SS",  0xFFFF6B6B.toInt())  // red
        score >= 49 -> Grade("S",   0xFFC084FC.toInt())  // purple
        score >= 43 -> Grade("A",   0xFF60A5FA.toInt())  // blue
        score >= 37 -> Grade("B",   0xFF4ADE80.toInt())  // green
        score > 0   -> Grade("C",   0xFF9CA3AF.toInt())  // gray
        else        -> null
    }
}
