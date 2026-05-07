package com.hubczn.optimizer.data.repository

import android.content.Context
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

data class CharInfo(
    val resId: Int,
    val rarity: Int,
    val kind: String
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
                kind = obj["kind"]!!.jsonPrimitive.content
            )
        }
    }

    fun lookup(name: String): CharInfo? = lookup[name]

    fun allNames(): List<String> = lookup.keys.toList()
}
