package com.hubczn.optimizer.model

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

@Serializable
data class RescueRecord(
    @SerialName("gacha_id") val gachaId: String,
    @SerialName("banner_name") val bannerName: String,
    val type: String,
    val name: String,
    @SerialName("rescue_type") val rescueType: String,
    @SerialName("createAt") val createAt: String,
    @SerialName("is_featured") val isFeatured: Boolean
)
