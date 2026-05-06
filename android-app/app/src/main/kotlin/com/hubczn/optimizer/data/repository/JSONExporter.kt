package com.hubczn.optimizer.data.repository

import android.content.Context
import android.os.Environment
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.model.RescueRecord
import kotlinx.serialization.encodeToString
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.put
import kotlinx.serialization.json.putJsonArray
import kotlinx.serialization.json.putJsonObject
import java.io.File
import java.time.LocalDateTime
import java.time.format.DateTimeFormatter

class JSONExporter(private val context: Context) {

    private val json = Json { prettyPrint = true; encodeDefaults = true }
    private val tsFormat = DateTimeFormatter.ofPattern("yyyyMMdd_HHmmss")
    private val isoFormat = DateTimeFormatter.ofPattern("yyyy-MM-dd'T'HH:mm:ss")

    private fun outputDir(): File {
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        )
        if (!dir.exists()) dir.mkdirs()
        return dir
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
        val file = File(outputDir(), filename)
        file.writeText(json.encodeToString(payload))
        return file
    }

    fun exportRescueRecords(records: List<RescueRecord>, bannerName: String): File {
        val now = LocalDateTime.now()
        val filename = "rescue_records_android_${now.format(tsFormat)}.json"
        val payload = buildJsonObject {
            put("capture_time", now.format(isoFormat))
            put("source", "android_ocr")
            put("source_key", "rescue_records")
            put("records", json.encodeToJsonElement(records))
        }
        val file = File(outputDir(), filename)
        file.writeText(json.encodeToString(payload))
        return file
    }

    fun exportCombatants(combatants: List<Combatant>): File {
        val now = LocalDateTime.now()
        val filename = "combatants_android_${now.format(tsFormat)}.json"
        val payload = buildJsonObject {
            put("capture_time", now.format(isoFormat))
            put("source", "android_ocr")
            put("combatants", json.encodeToJsonElement(combatants))
        }
        val file = File(outputDir(), filename)
        file.writeText(json.encodeToString(payload))
        return file
    }
}
