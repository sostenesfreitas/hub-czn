package com.hubczn.optimizer.data.local

import android.content.Context
import android.os.Environment
import com.hubczn.optimizer.model.CombatantStats
import com.hubczn.optimizer.model.MemoryFragment
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.io.File

/**
 * Per-combatant manual corrections that override fields from the OCR
 * scan. Persisted as a single JSON file alongside the scan exports
 * (`Downloads/CZN-Scanner/combatants_overrides.json`) so it survives
 * app reinstalls and is hand-editable.
 *
 * Schema:
 * ```
 * {
 *   "Haru": {
 *     "ego": 1,
 *     "stats": { "attack": 1056, "defense": 178, "health": 538,
 *                "critical_chance": 35.8, "critical_damage": 237.5 },
 *     "fragments": {
 *       "1": { "id": 0, "slot_num": 1, "set_name": "Black Wing", ... }
 *     }
 *   }
 * }
 * ```
 *
 * Each top-level key is the canonical combatant name. Override fields
 * are partial — when a field is absent the OCR value passes through.
 */
class CombatantOverridesStore(@Suppress("unused") context: Context) {

    private val file: File by lazy {
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        ).apply { mkdirs() }
        File(dir, "combatants_overrides.json")
    }

    private val json = Json {
        prettyPrint = true
        ignoreUnknownKeys = true
        encodeDefaults = true
    }

    data class Overrides(
        val ego: Int? = null,
        val stats: CombatantStats? = null,
        /** slot_num (1..6) → full replacement fragment. */
        val fragments: Map<Int, MemoryFragment> = emptyMap(),
    )

    fun load(): Map<String, Overrides> {
        if (!file.exists()) return emptyMap()
        return try {
            val root = json.parseToJsonElement(file.readText()).jsonObject
            root.entries.associate { (name, raw) ->
                val obj = raw.jsonObject
                val ego = obj["ego"]?.jsonPrimitive?.intOrNull
                val stats = obj["stats"]?.let {
                    json.decodeFromJsonElement(CombatantStats.serializer(), it)
                }
                val fragments = obj["fragments"]?.jsonObject?.entries
                    ?.mapNotNull { (k, v) ->
                        val slot = k.toIntOrNull() ?: return@mapNotNull null
                        slot to json.decodeFromJsonElement(MemoryFragment.serializer(), v)
                    }?.toMap() ?: emptyMap()
                name to Overrides(ego = ego, stats = stats, fragments = fragments)
            }
        } catch (_: Exception) {
            emptyMap()
        }
    }

    private fun mutate(combatantName: String, transform: (JsonObject) -> JsonObject) {
        val existing = if (file.exists()) {
            try { json.parseToJsonElement(file.readText()).jsonObject }
            catch (_: Exception) { JsonObject(emptyMap()) }
        } else JsonObject(emptyMap())

        val priorEntry = existing[combatantName]?.jsonObject ?: JsonObject(emptyMap())
        val newEntry = transform(priorEntry)

        val rebuilt = buildJsonObject {
            for ((name, value) in existing) {
                if (name == combatantName) continue
                put(name, value)
            }
            if (newEntry.isNotEmpty()) put(combatantName, newEntry)
        }
        file.writeText(json.encodeToString(JsonObject.serializer(), rebuilt))
    }

    fun setEgo(combatantName: String, ego: Int?) = mutate(combatantName) { prior ->
        buildJsonObject {
            for ((k, v) in prior) {
                if (k == "ego") continue
                put(k, v)
            }
            if (ego != null) put("ego", JsonPrimitive(ego))
        }
    }

    fun setStats(combatantName: String, stats: CombatantStats?) = mutate(combatantName) { prior ->
        buildJsonObject {
            for ((k, v) in prior) {
                if (k == "stats") continue
                put(k, v)
            }
            if (stats != null) {
                put("stats", json.encodeToJsonElement(CombatantStats.serializer(), stats))
            }
        }
    }

    /**
     * Sets (or clears with [fragment] = null) the override for the
     * fragment in [slotNum]. Other slots' overrides are preserved.
     */
    fun setFragment(combatantName: String, slotNum: Int, fragment: MemoryFragment?) =
        mutate(combatantName) { prior ->
            val priorFragments: Map<String, JsonElement> =
                prior["fragments"]?.jsonObject ?: JsonObject(emptyMap())
            val newFragments = buildJsonObject {
                for ((k, v) in priorFragments) {
                    if (k == slotNum.toString()) continue
                    put(k, v)
                }
                if (fragment != null) {
                    put(slotNum.toString(), json.encodeToJsonElement(MemoryFragment.serializer(), fragment))
                }
            }
            buildJsonObject {
                for ((k, v) in prior) {
                    if (k == "fragments") continue
                    put(k, v)
                }
                if (newFragments.isNotEmpty()) put("fragments", newFragments)
            }
        }
}
