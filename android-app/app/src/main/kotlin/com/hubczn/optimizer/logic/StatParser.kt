package com.hubczn.optimizer.logic

object StatParser {

    // Stat name + optional "+N" upgrade-rolls suffix. The whitespace
    // between the name and "+N" is OPTIONAL because ML Kit occasionally
    // merges them into one block ("Defense+1" instead of "Defense +1");
    // without `\s?`, that block parses as a single name "Defense+1"
    // with rolls=0 and pollutes the export.
    private val NAME_PATTERN = Regex("""^([A-Za-z][A-Za-z\s]*?)(?:\s?\+(\d+))?$""")
    private val VALUE_PATTERN = Regex("""^\+?(\d+\.?\d*)(%?)$""")

    fun parseStatName(raw: String): Pair<String, Int> {
        // Strip a non-alpha prefix like "+ " or "› " or "» " — ML Kit
        // sometimes prefixes the stat name with the upgrade-roll
        // chevron rendered as a stray "+" glyph (e.g. "+ Ego Recovery
        // +1"), which would otherwise leave the name unparseable.
        var t = raw.trim()
        while (t.isNotEmpty() && !t.first().isLetter()) t = t.substring(1).trimStart()
        val match = NAME_PATTERN.matchEntire(t) ?: return Pair(t, 0)
        val name = match.groupValues[1].trim()
        val rolls = match.groupValues[2].toIntOrNull() ?: 0
        return Pair(name, rolls)
    }

    fun parseStatValue(raw: String): Pair<Double, String>? {
        val match = VALUE_PATTERN.matchEntire(raw.trim()) ?: return null
        val value = match.groupValues[1].toDoubleOrNull() ?: return null
        val type = if (match.groupValues[2] == "%") "percent" else "flat"
        return Pair(value, type)
    }
}
