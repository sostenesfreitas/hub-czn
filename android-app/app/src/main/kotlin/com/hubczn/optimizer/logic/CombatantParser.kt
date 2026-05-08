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

    /**
     * Canonical Memory Fragment set names (mirrors api/game_data/sets.py
     * in the desktop project). Used to fuzzy-snap OCR'd set names to a
     * known good value, fixing cases where ML Kit truncates or reorders
     * tokens (e.g. "ent's Flames" -> "Judgment's Flames",
     * "Authority Tetra'" -> "Tetra's Authority",
     * "Conqueror's Aspect ldeal" -> "Conqueror's Aspect").
     */
    private val CANONICAL_SET_NAMES = listOf(
        "Conqueror's Aspect", "Tetra's Authority", "Healer's Journey",
        "Black Wing", "Seth's Scarab", "Executioner's Tool",
        "Instinctual Growth", "Bullet of Order", "Offering of the Void",
        "Spark of Passion", "Cursed Corpse", "Line of Justice",
        "Wireth's Steel", "Orb of Inhibition", "Judgment's Flames",
        "Beast's Yearning", "Glory's Reign", "Prelude to a Hero",
        "Starlight and Dreams"
    )

    /**
     * Snaps a raw OCR'd set name to the closest canonical set in
     * [CANONICAL_SET_NAMES]. A canonical name is considered a match when at
     * least half of its words have an OCR counterpart that either equals,
     * contains, or is contained by that canonical word (case-insensitive).
     * Returns the original OCR'd value if no canonical scores above 0.5.
     */
    fun fuzzySnapSetName(ocrName: String): String {
        val ocrWords = ocrName.split(Regex("\\s+")).filter { it.isNotBlank() }
        if (ocrWords.isEmpty()) return ocrName

        var best = ocrName
        var bestScore = 0.0
        for (canonical in CANONICAL_SET_NAMES) {
            val canonWords = canonical.split(Regex("\\s+"))
            var matches = 0
            for (cw in canonWords) {
                val matched = ocrWords.any { ow ->
                    cw.equals(ow, ignoreCase = true) ||
                        (ow.length >= 3 && cw.contains(ow, ignoreCase = true)) ||
                        (cw.length >= 3 && ow.contains(cw, ignoreCase = true))
                }
                if (matched) matches++
            }
            val score = matches.toDouble() / canonWords.size
            if (score > bestScore && score >= 0.5) {
                bestScore = score
                best = canonical
            }
        }
        return best
    }

    fun parseLevel(text: String): Pair<Int, Int> {
        val match = LEVEL_PATTERN.find(text) ?: return Pair(0, 0)
        return Pair(
            match.groupValues[1].toIntOrNull() ?: 0,
            match.groupValues[2].toIntOrNull() ?: 0
        )
    }

    fun parseStats(blocks: List<OcrBlock>): Combatant? {
        // Anchor on the level block — "Lv. NN/NN" is a strong unique pattern.
        // The combatant name sits directly above it on the same right-side
        // column. Anchoring on level instead of hardcoded coords makes this
        // robust across portrait/landscape orientations and device sizes.
        val levelBlock = blocks.firstOrNull { LEVEL_PATTERN.containsMatchIn(it.text) } ?: return null
        val (level, maxLevel) = parseLevel(levelBlock.text)

        val xTol = 200
        val nameBlock = blocks
            .filter { b ->
                b !== levelBlock &&
                    b.bounds.bottom <= levelBlock.bounds.top &&
                    !LEVEL_PATTERN.containsMatchIn(b.text) &&
                    kotlin.math.abs(b.bounds.exactCenterX() - levelBlock.bounds.exactCenterX()) < xTol
            }
            .maxByOrNull { it.bounds.bottom }
            ?: return null
        val name = nameBlock.text.trim()

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

        // Accept 3+ stats — OCR sometimes misses 1-2 values on the Stats
        // panel due to font rendering or glow effects. Returning null when
        // even one stat is missing leaves the scanner unable to advance,
        // which is worse than a partial record.
        if (statValues.size < 3) return null

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

    /**
     * Parses the right-side detail panel that appears after tapping an
     * equipped Memory Fragment slot. Returns null when the slot is empty
     * (no rarity badge or title visible). Reuses the existing FragmentParser
     * primitives so behaviour matches the inventory scanner.
     *
     * Caller is expected to filter `blocks` to the right panel area before
     * passing in, but the function tolerates extra blocks from elsewhere on
     * the screen — the rarity / title / stat detection is keyword-based.
     */
    fun parseFragmentPanel(
        blocks: List<com.hubczn.optimizer.model.OcrBlock>,
        slotNum: Int,
        equippedCharName: String
    ): com.hubczn.optimizer.model.MemoryFragment? {
        // Rarity: first block whose text STARTS with a known rarity keyword.
        // ML Kit sometimes merges the rarity badge with the trailing "+N"
        // upgrade indicator into a single block (e.g. "Legendary +5"),
        // so we match by prefix rather than equality.
        val rarityBlock = blocks.firstOrNull { b ->
            val t = b.text.trim()
            FragmentParser.RARITY_MAP.keys.any { t.startsWith(it) }
        } ?: return null
        val rarity = FragmentParser.RARITY_MAP.keys.first { rarityBlock.text.trim().startsWith(it) }
        val rarityNum = FragmentParser.RARITY_MAP[rarity] ?: 0

        // Level: try four sources, in order of confidence:
        //   1. "+N" embedded in the rarity block (combatant-panel
        //      layout often merges them: "Legendary +5").
        //   2. A "+N" sibling on the same row as the rarity block.
        //   3. The inventory panel renders the level inside the
        //      "Upgrade +N" button at the bottom of the dialog —
        //      detect by finding any block whose text contains
        //      "Upgrade" (case-insensitive) and harvesting its own
        //      "+N" or a same-row sibling.
        //   4. Fall back to 0 (treated as "+0 / unupgraded").
        val rowTol = 30
        val embeddedLevel = Regex("""\+(\d+)""").find(rarityBlock.text)
            ?.groupValues?.get(1)?.toIntOrNull()
        val level = embeddedLevel ?: run {
            val rarityRowSibling = blocks.firstOrNull { b ->
                kotlin.math.abs(b.bounds.top - rarityBlock.bounds.top) < rowTol &&
                    Regex("""^\+\d+$""").matches(b.text.trim())
            }
            val raritySiblingLevel = rarityRowSibling?.let { FragmentParser.parseUpgradeLevel(it.text) }
            if (raritySiblingLevel != null && raritySiblingLevel in 0..5) {
                return@run raritySiblingLevel
            }
            // "Upgrade +N" — inventory detail panel layout.
            val upgradeBlock = blocks.firstOrNull {
                it.text.contains("Upgrade", ignoreCase = true)
            }
            if (upgradeBlock != null) {
                val embedded = Regex("""\+(\d+)""").find(upgradeBlock.text)
                    ?.groupValues?.get(1)?.toIntOrNull()
                if (embedded != null && embedded in 0..5) return@run embedded
                val sibling = blocks.firstOrNull { b ->
                    kotlin.math.abs(b.bounds.top - upgradeBlock.bounds.top) < rowTol &&
                        Regex("""^\+\d+$""").matches(b.text.trim()) &&
                        (b.text.trim().drop(1).toIntOrNull() ?: -1) in 0..5
                }
                if (sibling != null) return@run FragmentParser.parseUpgradeLevel(sibling.text)
            }
            0
        }

        // Title row sits immediately below the rarity row. We greedy-merge
        // any blocks on that row to recover multi-word set names like
        // "Executioner's Tool" that ML Kit may split. The slot-type word
        // (Shock/Suppression/...) is the last token; everything before is
        // the set name.
        val titleAnchor = blocks
            .filter { it.bounds.top >= rarityBlock.bounds.bottom }
            .minByOrNull { it.bounds.top }
            ?: return null
        val titleBlocks = blocks
            .filter { kotlin.math.abs(it.bounds.top - titleAnchor.bounds.top) < rowTol }
            .sortedBy { it.bounds.left }
        if (titleBlocks.isEmpty()) return null
        val titleText = titleBlocks.joinToString(" ") { it.text.trim() }.trim()
        val titleParts = titleText.split(Regex("""\s+"""))
        if (titleParts.size < 2) return null
        // Strip ALL slot-type words (Shock/Suppression/Denial/Ideal/Desire/
        // Imagination) from the title — those are slot identifiers, never
        // part of the set name. We can't rely on `dropLast(1)` because the
        // slot label sometimes leaks in from a nearby slot icon (the
        // selected slot's word repeats at the title position, producing
        // duplicates like "Authority Suppression Suppression" that
        // dropLast wouldn't handle).
        val slotWords = setOf("Shock", "Suppression", "Denial", "Ideal", "Desire", "Imagination")
        val cleanedParts = titleParts.filterNot { it in slotWords }
        if (cleanedParts.isEmpty()) return null
        // Snap the (possibly truncated/reordered) OCR set name to the
        // closest canonical set so downstream consumers always see a
        // recognisable value.
        val setName = fuzzySnapSetName(cleanedParts.joinToString(" "))

        // Stats: blocks below the title and above the "Set Effect" header.
        val setEffectTop = blocks.firstOrNull { it.text.trim() == "Set Effect" }?.bounds?.top
            ?: Int.MAX_VALUE
        val statsBlocks = blocks.filter {
            it.bounds.top > titleBlocks.last().bounds.bottom && it.bounds.top < setEffectTop
        }
        val statList = FragmentParser.parseStats(statsBlocks)
        if (statList.isEmpty()) return null

        return com.hubczn.optimizer.model.MemoryFragment(
            id = 0,
            slotNum = slotNum,
            setName = setName,
            rarity = rarity,
            rarityNum = rarityNum,
            level = level,
            locked = false,
            equippedCharName = equippedCharName,
            statList = statList
        )
    }
}
