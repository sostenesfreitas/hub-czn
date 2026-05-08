package com.hubczn.optimizer.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class CombatantStats(
    val attack: Double,
    val defense: Double,
    val health: Double,
    @SerialName("critical_chance") val criticalChance: Double,
    @SerialName("critical_damage") val criticalDamage: Double
)

@Serializable
data class Combatant(
    val name: String,
    val level: Int,
    @SerialName("max_level") val maxLevel: Int,
    val stars: Int,
    val stats: CombatantStats,
    /** Ego Manifestation level shown on the grid card (0..6). 0 means
     *  not unlocked (the card displays "00"). */
    val ego: Int = 0,
    @SerialName("equipped_fragments") val equippedFragments: List<MemoryFragment> = emptyList()
)
