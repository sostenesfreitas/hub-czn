package com.hubczn.optimizer.logic

import com.hubczn.optimizer.model.MemoryFragment

/**
 * Lightweight gear optimiser. For each of the 6 slots, returns the
 * top-N fragments ranked by gear score (or weighted priority score),
 * with optional filters. Scope is intentionally per-slot only: no
 * 6-piece combinatorial search — the user picks one fragment per
 * slot from the suggested top picks and the [StatCalculator]
 * computes the resulting build's final stats.
 */
object OptimizerEngine {

    data class Filters(
        /** Restrict to fragments belonging to these set names. */
        val sets: Set<String> = emptySet(),
        /** Slots 4/5/6 only — restrict main stat to these names. */
        val mainStats: Set<String> = emptySet(),
        /** Minimum rarity (numeric: Legendary=5, Epic=4, Rare=3, etc.). */
        val minRarity: Int = 2,
        /** When true, include fragments already equipped by other combatants. */
        val includeEquipped: Boolean = true,
        /** Weights per stat name for priority scoring; null = use plain gear score. */
        val priorities: Map<String, Int>? = null,
    )

    /**
     * Returns slot 1..6 → list of top fragments (size ≤ [topN]).
     */
    fun rank(
        fragments: List<MemoryFragment>,
        filters: Filters = Filters(),
        topN: Int = 5,
    ): Map<Int, List<MemoryFragment>> {
        val result = mutableMapOf<Int, List<MemoryFragment>>()
        for (slot in 1..6) {
            val slotCandidates = fragments.asSequence()
                .filter { it.slotNum == slot && it.rarityNum >= filters.minRarity }
                .filter { filters.sets.isEmpty() || it.setName in filters.sets }
                .filter { slot !in 4..6 || filters.mainStats.isEmpty() ||
                    (it.statList.firstOrNull()?.stat in filters.mainStats) }
                .filter { filters.includeEquipped || it.equippedCharName.isNullOrBlank() }
                .toList()

            val ranked = if (filters.priorities != null) {
                slotCandidates.sortedByDescending { priorityScore(it, filters.priorities) }
            } else {
                slotCandidates.sortedByDescending { FragmentScorer.gearScore(it) }
            }
            result[slot] = ranked.take(topN)
        }
        return result
    }

    /**
     * Pick the single best fragment per slot to form a default
     * 6-piece "recommended" build.
     */
    fun recommendedBuild(
        fragments: List<MemoryFragment>,
        filters: Filters = Filters(),
    ): List<MemoryFragment> = rank(fragments, filters, topN = 1)
        .values.flatten().sortedBy { it.slotNum }

    /**
     * Priority score = sum over substats of (per-roll efficiency
     * × roll count × user weight). Mirrors the desktop's
     * `calculate_priority_score` logic.
     */
    private fun priorityScore(f: MemoryFragment, priorities: Map<String, Int>): Double {
        var score = 0.0
        for (s in f.statList.drop(1)) {
            val w = priorities[s.stat] ?: 0
            if (w == 0) continue
            val max = FragmentScorer.maxRoll(s) ?: continue
            val rolls = s.extraRolls + 1
            val normalized = if (max > 0 && rolls > 0) s.value / (max * rolls) else 0.0
            score += normalized * rolls * w
        }
        return score
    }
}
