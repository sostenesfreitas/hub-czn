package com.hubczn.optimizer.logic

import com.hubczn.optimizer.data.repository.CharInfo
import com.hubczn.optimizer.model.MemoryFragment

/**
 * Final-stat calculator for a 6-piece gear build, ported (in trimmed
 * form) from `api/optimizer/optimizer.py: GearOptimizer.calculate_build_stats`.
 *
 * Trimmed: this version IGNORES partner cards, potential nodes, and
 * friendship bonuses — Android scan does not capture them. Set
 * bonuses for the 2-piece flat-stat sets (Tetra's Authority +12%
 * DEF, Healer's Journey +12% HP, Black Wing +12% ATK, Executioner's
 * Tool +25% CDmg) ARE applied. 4-piece conditional set effects are
 * ignored — they need combat context the optimizer can't assume.
 */
data class FinalStats(
    val attack: Double,
    val defense: Double,
    val health: Double,
    val critRate: Double,
    val critDmg: Double,
    val ego: Double,
    val extraDmg: Double,
    val dotDmg: Double,
) {
    /** Average DMG: rough damage-per-hit metric. */
    val avgDmg: Double get() = attack * (1.0 + (critRate / 100.0) * (critDmg / 100.0 - 1.0))
    /** EHP: effective HP against physical/typeless. */
    val ehp: Double get() = health * (1.0 + defense / 200.0)
}

object StatCalculator {

    /** 2-piece set bonuses (stat name → percent value). */
    private val TWO_PIECE_BONUSES: Map<String, Pair<String, Double>> = mapOf(
        "Tetra's Authority"   to ("DEF%" to 12.0),
        "Healer's Journey"    to ("HP%"  to 12.0),
        "Black Wing"          to ("ATK%" to 12.0),
        "Executioner's Tool"  to ("CDmg" to 25.0),
        "Line of Justice"     to ("ATK%" to 17.0),
        "Wireth's Steel"      to ("DEF%" to 20.0),
    )

    /**
     * Compute final stats for [char] equipped with [gear] (any
     * subset of slots 1..6; missing slots contribute nothing).
     */
    fun finalStats(char: CharInfo, gear: List<MemoryFragment>): FinalStats {
        var atkPct = 0.0; var defPct = 0.0; var hpPct = 0.0
        var flatAtk = 0.0; var flatDef = 0.0; var flatHp = 0.0
        var crit = 0.0; var critD = 0.0
        var ego = 0.0; var extra = 0.0; var dot = 0.0

        for (frag in gear) {
            for (s in frag.statList) {
                when (s.stat) {
                    "Attack"           -> if (s.type == "percent") atkPct += s.value else flatAtk += s.value
                    "Defense"          -> if (s.type == "percent") defPct += s.value else flatDef += s.value
                    "Health"           -> if (s.type == "percent") hpPct += s.value else flatHp += s.value
                    "Critical Chance"  -> crit += s.value
                    "Critical Damage"  -> critD += s.value
                    "Ego", "Ego Recovery" -> ego += s.value
                    "Extra Damage"     -> extra += s.value
                    "Damage over time" -> dot += s.value
                    // Elemental damage stats: not summed into base stats.
                }
            }
        }

        // Set 2-piece bonuses: count fragments per set, apply when ≥2.
        val setCounts = gear.groupingBy { it.setName }.eachCount()
        for ((setName, count) in setCounts) {
            if (count < 2) continue
            val bonus = TWO_PIECE_BONUSES[setName] ?: continue
            when (bonus.first) {
                "ATK%" -> atkPct += bonus.second
                "DEF%" -> defPct += bonus.second
                "HP%"  -> hpPct  += bonus.second
                "CDmg" -> critD  += bonus.second
            }
        }

        val finalAtk = char.baseAtk * (1.0 + atkPct / 100.0) + flatAtk
        val finalDef = char.baseDef * (1.0 + defPct / 100.0) + flatDef
        val finalHp  = char.baseHp  * (1.0 + hpPct  / 100.0) + flatHp
        val finalCr  = char.baseCritRate + crit
        val finalCd  = char.baseCritDmg  + critD

        return FinalStats(
            attack = finalAtk,
            defense = finalDef,
            health = finalHp,
            critRate = finalCr,
            critDmg = finalCd,
            ego = ego,
            extraDmg = extra,
            dotDmg = dot,
        )
    }
}
