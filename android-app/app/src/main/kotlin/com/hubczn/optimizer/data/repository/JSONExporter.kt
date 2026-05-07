package com.hubczn.optimizer.data.repository

import android.content.Context
import android.net.Uri
import android.os.Environment
import com.hubczn.optimizer.data.local.RescueRecordDao
import com.hubczn.optimizer.data.local.RescueRecordEntity
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.MemoryFragment
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

    /** Export all rescue records from DB in desktop-compatible format. */
    suspend fun exportRescueRecordsFromDb(): String {
        val rescueDao = requireNotNull(dao) { "dao must be provided to use exportRescueRecordsFromDb" }
        val now = LocalDateTime.now()
        val filename = "rescue_records_android_${now.format(tsFormat)}.json"
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

        val (out, name) = openOutputStream(filename)
        out.use { it.write(json.encodeToString(payload).toByteArray()) }
        return name
    }

    private fun parseTimestamp(createAt: String): Long = try {
        LocalDateTime.parse(createAt, createAtFormat).toEpochSecond(ZoneOffset.UTC)
    } catch (e: Exception) {
        0L
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
