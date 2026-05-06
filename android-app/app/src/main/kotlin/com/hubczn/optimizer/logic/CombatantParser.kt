package com.hubczn.optimizer.logic

import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.CombatantStats
import com.hubczn.optimizer.model.OcrBlock

object CombatantParser {

    private val LEVEL_PATTERN = Regex("""Lv\.\s*(\d+)/(\d+)""")
    private val STAT_LABELS = mapOf(
        "Attack"          to "attack",
        "Defense"         to "defense",
        "Health"          to "health",
        "Critical Chance" to "criticalChance",
        "Critical Damage" to "criticalDamage"
    )

    fun parseLevel(text: String): Pair<Int, Int> {
        val match = LEVEL_PATTERN.find(text) ?: return Pair(0, 0)
        return Pair(
            match.groupValues[1].toIntOrNull() ?: 0,
            match.groupValues[2].toIntOrNull() ?: 0
        )
    }

    fun parseStats(blocks: List<OcrBlock>): Combatant? {
        // Extract name: largest Y near top-right of screen (character name area)
        val nameBlock = blocks.filter { it.bounds.top < 150 && it.bounds.left > 500 }
            .maxByOrNull { it.bounds.left } ?: return null
        val name = nameBlock.text

        // Extract level
        val levelBlock = blocks.firstOrNull { LEVEL_PATTERN.containsMatchIn(it.text) }
        val (level, maxLevel) = levelBlock?.let { parseLevel(it.text) } ?: Pair(0, 0)

        // Group into rows
        val rows = mutableListOf<MutableList<OcrBlock>>()
        for (block in blocks.sortedBy { it.bounds.top }) {
            val last = rows.lastOrNull()
            if (last != null && block.bounds.top - last.first().bounds.top < 20) {
                last.add(block)
            } else {
                rows.add(mutableListOf(block))
            }
        }

        val statValues = mutableMapOf<String, Double>()
        for (row in rows) {
            val sorted = row.sortedBy { it.bounds.left }
            val label = sorted.firstOrNull { it.text in STAT_LABELS }?.text ?: continue
            val valueText = sorted.lastOrNull()?.text ?: continue
            val value = valueText.trimEnd('%').toDoubleOrNull() ?: continue
            statValues[STAT_LABELS[label]!!] = value
        }

        if (statValues.size < 5) return null

        return Combatant(
            name = name,
            level = level,
            maxLevel = maxLevel,
            stars = 0,  // stars use icon images, not readable via text OCR
            stats = CombatantStats(
                attack = statValues["attack"] ?: 0.0,
                defense = statValues["defense"] ?: 0.0,
                health = statValues["health"] ?: 0.0,
                criticalChance = statValues["criticalChance"] ?: 0.0,
                criticalDamage = statValues["criticalDamage"] ?: 0.0
            )
        )
    }
}
