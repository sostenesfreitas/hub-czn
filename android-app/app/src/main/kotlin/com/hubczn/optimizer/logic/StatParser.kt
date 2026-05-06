package com.hubczn.optimizer.logic

object StatParser {

    private val NAME_PATTERN = Regex("""^([A-Za-z][A-Za-z\s]*?)(?:\s\+(\d+))?$""")
    private val VALUE_PATTERN = Regex("""^\+?(\d+\.?\d*)(%?)$""")

    fun parseStatName(raw: String): Pair<String, Int> {
        val match = NAME_PATTERN.matchEntire(raw.trim()) ?: return Pair(raw.trim(), 0)
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
