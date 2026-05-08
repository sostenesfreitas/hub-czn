package com.hubczn.optimizer.ui

import android.app.Application
import android.os.Environment
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hubczn.optimizer.data.repository.SetRepository
import com.hubczn.optimizer.model.MemoryFragment
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import java.io.File

/**
 * Loads the most recent `memory_fragments_android_*.json` snapshot
 * exported by the Memory Fragments scanner and exposes it as a list
 * of [MemoryFragment] for the UI. Read-only.
 */
class FragmentsViewModel(app: Application) : AndroidViewModel(app) {

    val setRepo = SetRepository(app)

    private val _state = MutableStateFlow(State(loading = true))
    val state: StateFlow<State> = _state

    data class State(
        val loading: Boolean = false,
        val fragments: List<MemoryFragment> = emptyList(),
        val sourceFile: String? = null,
        val error: String? = null,
    )

    init { reload() }

    fun reload() {
        viewModelScope.launch {
            _state.value = State(loading = true)
            _state.value = withContext(Dispatchers.IO) { loadFromDisk() }
        }
    }

    private fun loadFromDisk(): State {
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        )
        if (!dir.exists()) {
            return State(error = "No exports folder found at ${dir.absolutePath}")
        }
        val latest = dir.listFiles { f ->
            f.name.startsWith("memory_fragments_android_") && f.name.endsWith(".json")
        }?.maxByOrNull { it.lastModified() }
            ?: return State(error = "No memory_fragments_*.json export found. Run a Memory Fragments scan first.")

        return try {
            val payload = Json.parseToJsonElement(latest.readText()).jsonObject
            val arr = payload["inventory"]?.jsonObject
                ?.get("piece_items")?.jsonArray
                ?: return State(error = "Invalid export format (missing inventory.piece_items).")
            val parser = Json { ignoreUnknownKeys = true }
            val fragments = arr.map { el ->
                parser.decodeFromJsonElement(MemoryFragment.serializer(), el)
            }
            State(fragments = fragments, sourceFile = latest.name)
        } catch (e: Exception) {
            State(error = "Parse error: ${e.message}")
        }
    }
}
