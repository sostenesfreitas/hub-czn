package com.hubczn.optimizer.data.repository

import android.content.Context
import android.net.Uri
import android.os.Environment
import com.hubczn.optimizer.data.local.RescueRecordDao
import com.hubczn.optimizer.data.local.RescueRecordEntity
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.MemoryFragment
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.long
import kotlinx.serialization.json.longOrNull
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonArray
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.File
import java.io.OutputStream
import java.time.LocalDateTime
import java.time.ZoneOffset
import java.time.format.DateTimeFormatter

class JSONExporter(
    private val context: Context,
    private val dao: RescueRecordDao? = null,
    private val outputFolderUri: Uri? = null
) {
    private val json = Json { prettyPrint = true; encodeDefaults = true }
    private val tsFormat = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")
    private val isoFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")
    private val createAtFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd HH:mm:ss")

    private fun openOutputStream(filename: String): Pair<OutputStream, String> {
        if (outputFolderUri != null) {
            val docUri = androidx.documentfile.provider.DocumentFile
                .fromTreeUri(context, outputFolderUri)!!
                .createFile("application/json", filename)!!
                .uri
            return context.contentResolver.openOutputStream(docUri)!! to filename
        }
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        ).also { it.mkdirs() }
        val file = File(dir, filename)
        return file.outputStream() to file.name
    }

    /** Suggested filename for a fresh export, e.g. for a Save As dialog. */
    fun suggestRescueRecordsFilename(): String =
        "rescue_records_android_${LocalDateTime.now().format(tsFormat)}.json"

    /** Build the desktop-compatible rescue records JSON without touching the filesystem. */
    suspend fun buildRescueRecordsJsonString(): String {
        val rescueDao = requireNotNull(dao) { "dao must be provided to use buildRescueRecordsJsonString" }
        val allRecords = rescueDao.getAllOrderedByPullNumber()
        val grouped = allRecords.groupBy { it.bannerName }

        val payload = buildJsonArray {
            for ((bannerName, records) in grouped) {
                add(buildJsonObject {
                    put("banner_name", bannerName)
                    putJsonArray("pulls") {
                        var pityCounter = 0
                        for (r in records) {
                            pityCounter++
                            val pity = pityCounter
                            if ((r.rarity ?: 0) >= 5) pityCounter = 0
                            add(buildJsonObject {
                                put("pull_number", r.pullNumber)
                                put("res_id", r.resId ?: 0)
                                put("name", r.name)
                                put("rarity", r.rarity ?: 3)
                                put("kind", r.type.removeSuffix("s"))
                                put("image_url", "/assets/game/faces/bookmark_face_character_map_${r.resId}.png")
                                put("pity", pity)
                                put("is_featured", r.isFeatured)
                                put("timestamp", parseTimestamp(r.createAt))
                            })
                        }
                    }
                })
            }
        }
        return json.encodeToString(payload)
    }

    /** Export all rescue records from DB in desktop-compatible format. */
    suspend fun exportRescueRecordsFromDb(): String {
        val filename = suggestRescueRecordsFilename()
        val content = buildRescueRecordsJsonString()
        val (out, name) = openOutputStream(filename)
        out.use { it.write(content.toByteArray()) }
        return name
    }

    private fun parseTimestamp(createAt: String): Long = try {
        LocalDateTime.parse(createAt, createAtFormat).toEpochSecond(ZoneOffset.UTC)
    } catch (e: Exception) {
        0L
    }

    /**
     * Replace ALL records in the DB with the contents of a desktop-format
     * rescue_records JSON. Test/dev tool — production users get data via OCR.
     *
     * @return number of records inserted
     */
    suspend fun importDesktopRescueJson(jsonContent: String): Int {
        val rescueDao = requireNotNull(dao) { "dao must be provided to use importDesktopRescueJson" }
        val parsed = Json.parseToJsonElement(jsonContent)
        val banners: List<JsonObject> = when (parsed) {
            is JsonArray -> parsed.mapNotNull { (it as? JsonObject) }
            is JsonObject -> {
                // Tolerate { records: [...] } envelope from older snapshots
                val recs = parsed["records"]
                (recs as? JsonArray)?.mapNotNull { it as? JsonObject } ?: emptyList()
            }
            else -> emptyList()
        }

        // Build entities, assigning duplicateIdx 0..N-1 within each natural-key group.
        data class Key(val banner: String, val name: String, val type: String, val createAt: String, val rescueType: String, val isFeatured: Boolean)
        val groupCounter = mutableMapOf<Key, Int>()
        val entities = mutableListOf<RescueRecordEntity>()

        for (banner in banners) {
            val bannerName = banner["banner_name"]?.jsonPrimitive?.content ?: continue
            val pulls = (banner["pulls"] as? JsonArray) ?: continue
            for (p in pulls) {
                val pull = p as? JsonObject ?: continue
                val resId = pull["res_id"]?.jsonPrimitive?.intOrNull
                val name = pull["name"]?.jsonPrimitive?.content ?: continue
                val rarity = pull["rarity"]?.jsonPrimitive?.intOrNull
                val kind = pull["kind"]?.jsonPrimitive?.content ?: "Combatant"
                val type = if (kind.endsWith("s")) kind else "${kind}s" // Partner -> Partners
                val isFeatured = pull["is_featured"]?.jsonPrimitive?.booleanOrNull ?: false
                val ts = pull["timestamp"]?.jsonPrimitive?.longOrNull ?: 0L
                val createAt = LocalDateTime.ofEpochSecond(ts, 0, ZoneOffset.UTC).format(createAtFormat)
                val rescueType = pull["rescue_type"]?.jsonPrimitive?.content ?: ""

                val key = Key(bannerName, name, type, createAt, rescueType, isFeatured)
                val dupIdx = groupCounter.getOrDefault(key, 0)
                groupCounter[key] = dupIdx + 1

                entities += RescueRecordEntity(
                    bannerName = bannerName,
                    name = name,
                    type = type,
                    createAt = createAt,
                    rescueType = rescueType,
                    isFeatured = isFeatured,
                    duplicateIdx = dupIdx,
                    resId = resId,
                    rarity = rarity,
                    pullNumber = 0, // will be reassigned by renumber
                )
            }
        }

        rescueDao.deleteAll()
        rescueDao.upsertAll(entities)
        rescueDao.renumberPullNumbersByCreateAt()
        return entities.size
    }

    fun exportFragments(fragments: List<MemoryFragment>): File {
        val now = LocalDateTime.now()
        val filename = "memory_fragments_android_${now.format(tsFormat)}.json"
        val payload = buildJsonObject {
            put("capture_time", now.format(isoFormat))
            put("source", "android_ocr")
            putJsonObject("inventory") {
                put("piece_items", json.encodeToJsonElement(fragments))
            }
            putJsonObject("characters") {
                putJsonArray("characters") {}
                putJsonObject("user") { put("source", "android_ocr") }
            }
            put("detected_region", "global")
        }
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        ).also { it.mkdirs() }
        return File(dir, filename).also { it.writeText(json.encodeToString(payload)) }
    }

    fun exportCombatants(combatants: List<Combatant>): File {
        val now = LocalDateTime.now()
        val filename = "combatants_android_${now.format(tsFormat)}.json"
        val payload = buildJsonObject {
            put("capture_time", now.format(isoFormat))
            put("source", "android_ocr")
            put("combatants", json.encodeToJsonElement(combatants))
        }
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        ).also { it.mkdirs() }
        return File(dir, filename).also { it.writeText(json.encodeToString(payload)) }
    }
}
