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
    @SerialName("equipped_fragments") val equippedFragments: List<Int> = emptyList()
)
