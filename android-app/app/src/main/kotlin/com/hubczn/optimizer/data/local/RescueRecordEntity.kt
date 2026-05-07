package com.hubczn.optimizer.data.local

import androidx.room.Entity
import androidx.room.Index
import androidx.room.PrimaryKey

@Entity(
    tableName = "rescue_records",
    indices = [
        Index(
            value = ["bannerName", "name", "type", "createAt", "rescueType", "isFeatured", "duplicateIdx"],
            unique = true
        )
    ]
)
data class RescueRecordEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val bannerName: String,
    val name: String,
    val type: String,
    val createAt: String,
    val rescueType: String,
    val isFeatured: Boolean,
    val duplicateIdx: Int,
    val resId: Int?,
    val rarity: Int?,
    val pullNumber: Long
)
