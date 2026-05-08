package com.hubczn.optimizer.data.repository

import android.content.Context
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive

/**
 * Set name → set ID lookup, mirroring `api/game_data/sets.py`.
 * The set ID is what fragment icon assets are keyed on:
 * `pieces/item_piece_set_<id 3-digit>_<slot 1..6>.png`.
 */
class SetRepository(context: Context) {

    private val nameToId: Map<String, Int>

    init {
        val raw = context.assets.open("sets.json").bufferedReader().readText()
        val json = Json.parseToJsonElement(raw).jsonObject
        nameToId = json.entries.associate { (name, value) ->
            name to value.jsonPrimitive.int
        }
    }

    fun idFor(setName: String): Int? = nameToId[setName]

    /** Asset path for the equipped piece icon at [slotNum] (1..6). */
    fun pieceAssetPath(setName: String, slotNum: Int): String? {
        val id = idFor(setName) ?: return null
        return "pieces/item_piece_set_%03d_%d.png".format(id, slotNum)
    }
}
