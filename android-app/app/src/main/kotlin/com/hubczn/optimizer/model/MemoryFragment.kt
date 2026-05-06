package com.hubczn.optimizer.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class MemoryFragment(
    val id: Int,
    @SerialName("slot_num") val slotNum: Int,
    @SerialName("set_name") val setName: String,
    val rarity: String,
    @SerialName("rarity_num") val rarityNum: Int,
    val level: Int,
    val locked: Boolean = false,
    @SerialName("equipped_char_name") val equippedCharName: String? = null,
    @SerialName("stat_list") val statList: List<StatEntry>
)
