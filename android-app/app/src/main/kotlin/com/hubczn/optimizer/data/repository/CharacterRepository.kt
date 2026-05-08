package com.hubczn.optimizer.data.repository

import android.content.Context
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.doubleOrNull
import kotlinx.serialization.json.jsonPrimitive

data class CharInfo(
    val resId: Int,
    val rarity: Int,
    val kind: String,
    val attribute: String,
    val charClass: String,
    val baseAtk: Double,
    val baseDef: Double,
    val baseHp: Double,
    val baseCritRate: Double,
    val baseCritDmg: Double,
) {
    val imageUrl: String get() = "/assets/game/faces/bookmark_face_character_map_$resId.png"
}

class CharacterRepository(context: Context) {
    private val lookup: Map<String, CharInfo>

    init {
        val raw = context.assets.open("characters.json").bufferedReader().readText()
        val json = Json.parseToJsonElement(raw).jsonObject
        lookup = json.entries.associate { (name, value) ->
            val obj = value.jsonObject
            name to CharInfo(
                resId = obj["res_id"]!!.jsonPrimitive.int,
                rarity = obj["rarity"]!!.jsonPrimitive.int,
                kind = obj["kind"]!!.jsonPrimitive.content,
                attribute = obj["attribute"]?.jsonPrimitive?.content ?: "Unknown",
                charClass = obj["class"]?.jsonPrimitive?.content ?: "Unknown",
                baseAtk = obj["base_atk"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
                baseDef = obj["base_def"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
                baseHp = obj["base_hp"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
                baseCritRate = obj["base_crit_rate"]?.jsonPrimitive?.doubleOrNull ?: 0.0,
                baseCritDmg = obj["base_crit_dmg"]?.jsonPrimitive?.doubleOrNull ?: 125.0,
            )
        }
    }

    fun lookup(name: String): CharInfo? = lookup[name]

    fun allNames(): List<String> = lookup.keys.toList()
}
