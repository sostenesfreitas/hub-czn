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

    /**
     * Game stat names recognised by the parser. Mirrors the desktop's
     * `api/game_data/constants.py` substat catalogue. "Extra Damage"
     * (Extra DMG%), "Damage over time" (DoT%), and "Ego Recovery" /
     * "Ego" must all be listed: the OCR returns the long English form,
     * not the desktop UI's abbreviated label, and the row-detection
     * needs an exact name match to anchor each substat row.
     */
    val STAT_NAMES = setOf(
        "Attack", "Defense", "Health",
        "Critical Chance", "Critical Damage",
        "Speed", "Effect Hit Rate", "Effect Resistance",
        "Extra Damage",
        "Damage over time",
        "Ego", "Ego Recovery",
        // Elemental DMG% — only the slot-V main stat in this game.
        // Without these, slot V Legendary fragments whose main stat is
        // an element (e.g. "Justice Damage +16%") drop the main row,
        // shifting the first substat into slot 0 and leaving the
        // export with 4 entries instead of 5.
        "Passion Damage", "Order Damage", "Justice Damage",
        "Void Damage", "Instinct Damage",
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
            // A stat-name block must (a) parse to one of the known game
            // stat names, OR (b) start with a letter and ALSO contain a
            // "+N" upgrade-rolls marker. The pure "+N" / "+N%" / "+N.N%"
            // blocks are stat VALUES (e.g. the value column on a row),
            // not stat names — accepting them as names produces junk
            // entries like {stat:"+16%"} or {stat:"+5"} and shifts the
            // main-stat ordering. Anchoring "starts with letter" rejects
            // those without losing legitimate compound names like
            // "Extra Damage +1".
            val nameText = texts.firstOrNull { t ->
                val trimmed = t.trim()
                if (trimmed.isEmpty()) return@firstOrNull false
                val (name, _) = StatParser.parseStatName(trimmed)
                if (name in STAT_NAMES) return@firstOrNull true
                // Fallback: a stat-name block contains a "+N" rolls
                // marker AND, after stripping any leading non-alpha
                // glyph (ML Kit sometimes prefixes "+ " or "› " from
                // the upgrade-roll chevron), starts with a letter.
                // Pure "+N" / "+N%" blocks (stat VALUES) still get
                // rejected.
                val stripped = trimmed.dropWhile { !it.isLetter() }
                stripped.isNotEmpty() && stripped.first().isLetter() &&
                    trimmed.contains(Regex("""\+\d+"""))
            } ?: return@forEachIndexed

            // The value is the LAST block in the row that parses as a
            // numeric stat value (e.g. "22", "3.4%"). Picking firstOrNull
            // would grab the upgrade-rolls "+1" suffix on the name block.
            val valueText = texts.lastOrNull { t ->
                StatParser.parseStatValue(t.trim()) != null
            } ?: return@forEachIndexed
            // Reject if the name and value are the same block (no
            // separate value column → not a real substat row).
            if (valueText === nameText) return@forEachIndexed

            val (statName, extraRolls) = StatParser.parseStatName(nameText)
            val (value, type) = StatParser.parseStatValue(valueText.trim()) ?: return@forEachIndexed

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
