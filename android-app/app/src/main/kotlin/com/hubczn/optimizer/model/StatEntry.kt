package com.hubczn.optimizer.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class StatEntry(
    val slot: Int,
    val stat: String,
    val type: String,
    val value: Double,
    @SerialName("extra_rolls") val extraRolls: Int
)
