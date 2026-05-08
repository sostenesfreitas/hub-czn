package com.hubczn.optimizer.logic

import com.hubczn.optimizer.model.OcrBlock
import com.hubczn.optimizer.model.RescueRecord

object RescueRecordParser {

    private val TIMESTAMP_PATTERN = Regex("""\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}""")
    private val TYPE_VALUES = setOf("Partners", "Combatants")

    fun parseTableRows(
        blocks: List<OcrBlock>,
        bannerName: String,
        headerY: Int
    ): List<RescueRecord> {
        // Only blocks below the header row
        val dataBlocks = blocks.filter { it.bounds.top > headerY + 10 }

        // Group into rows by Y band (30px tolerance)
        val rows = mutableListOf<MutableList<OcrBlock>>()
        for (block in dataBlocks.sortedBy { it.bounds.top }) {
            val last = rows.lastOrNull()
            if (last != null && block.bounds.top - last.first().bounds.top < 30) {
                last.add(block)
            } else {
                rows.add(mutableListOf(block))
            }
        }

        return rows.mapNotNull { row ->
            val sorted = row.sortedBy { it.bounds.left }
            val type = sorted.firstOrNull { it.text in TYPE_VALUES }?.text ?: return@mapNotNull null
            val timestamp = sorted.firstOrNull { TIMESTAMP_PATTERN.matches(it.text) }?.text ?: return@mapNotNull null
            val rescueType = sorted.firstOrNull {
                it.text.contains("Rate-Up") || it.text.contains("Standard") || it.text.contains("Free")
            }?.text ?: ""
            // Name is the block between type and rescueType columns
            val name = sorted.firstOrNull { b ->
                b.text != type && !TIMESTAMP_PATTERN.matches(b.text) &&
                !b.text.contains("Rate-Up") && !b.text.contains("Standard") && !b.text.contains("Free")
            }?.text ?: return@mapNotNull null

            RescueRecord(
                gachaId = inferGachaId(rescueType),
                bannerName = bannerName,
                type = type,
                name = name,
                rescueType = rescueType,
                createAt = timestamp,
                isFeatured = false  // cannot determine from OCR without color
            )
        }
    }

    fun inferGachaId(rescueType: String): String = when {
        rescueType.contains("Combatant", ignoreCase = true) -> "pickup_combatant"
        rescueType.contains("Partner", ignoreCase = true)   -> "pickup_partner"
        rescueType.contains("Free", ignoreCase = true)      -> "free"
        else                                                 -> "standard"
    }

    /**
     * Pass-through. Previously this collapsed records by natural key, but
     * legitimate batch duplicates (e.g. a 10-pull with two identical 3★ at the
     * same second) share that key and were being silently discarded, leading
     * to undercounted pity values vs. the desktop dataset.
     *
     * Re-read protection (same page scanned twice) is already handled in
     * RescueRecordScanner via the `records == previousPageRecords` early-stop,
     * so a separate dedup here would only destroy real data.
     */
    fun deduplicate(records: List<RescueRecord>): List<RescueRecord> = records
}
