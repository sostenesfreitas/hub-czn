package com.hubczn.optimizer.logic

import com.hubczn.optimizer.model.OcrBlock
import com.hubczn.optimizer.model.StatEntry

object FragmentParser {

    val RARITY_MAP = mapOf(
        "Legendary" to 5, "Epic" to 4, "Rare" to 3, "Uncommon" to 2
    )

    val SLOT_MAP = mapOf(
        "I" to 1, "II" to 2, "III" to 3, "IV" to 4, "V" to 5, "VI" to 6
    )

    val STAT_NAMES = setOf(
        "Attack", "Defense", "Health", "Critical Chance", "Critical Damage",
        "Speed", "Effect Hit Rate", "Effect Resistance"
    )

    fun parseRarity(text: String): Int = RARITY_MAP[text.trim()] ?: 0

    fun parseSlot(text: String): Int = SLOT_MAP[text.trim()] ?: 0

    fun parseUpgradeLevel(text: String): Int {
        return Regex("""\+(\d+)""").find(text)?.groupValues?.get(1)?.toIntOrNull() ?: 0
    }

    fun parseStats(blocks: List<OcrBlock>): List<StatEntry> {
        if (blocks.isEmpty()) return emptyList()

        // Group blocks by Y band (within 20px = same row)
        val rows = mutableListOf<MutableList<OcrBlock>>()
        for (block in blocks.sortedBy { it.bounds.top }) {
            val existing = rows.lastOrNull()
            if (existing != null && block.bounds.top - existing.first().bounds.top < 20) {
                existing.add(block)
            } else {
                rows.add(mutableListOf(block))
            }
        }

        val stats = mutableListOf<StatEntry>()
        rows.forEachIndexed { rowIndex, row ->
            val texts = row.sortedBy { it.bounds.left }.map { it.text }
            // Find stat name (matches known stat or has roll marker)
            val nameText = texts.firstOrNull { t ->
                val (name, _) = StatParser.parseStatName(t)
                name in STAT_NAMES || t.contains(Regex("""\+\d+"""))
            } ?: return@forEachIndexed

            val valueText = texts.firstOrNull { t ->
                StatParser.parseStatValue(t) != null
            } ?: return@forEachIndexed

            val (statName, extraRolls) = StatParser.parseStatName(nameText)
            val (value, type) = StatParser.parseStatValue(valueText) ?: return@forEachIndexed

            stats.add(StatEntry(
                slot = stats.size,   // 0 = first stat added = main stat
                stat = statName,
                type = type,
                value = value,
                extraRolls = extraRolls
            ))
        }
        return stats
    }
}
