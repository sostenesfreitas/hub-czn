package com.hubczn.optimizer.ui

import android.app.Application
import android.os.Environment
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hubczn.optimizer.data.repository.CharacterRepository
import com.hubczn.optimizer.data.repository.SetRepository
import com.hubczn.optimizer.logic.FinalStats
import com.hubczn.optimizer.logic.OptimizerEngine
import com.hubczn.optimizer.logic.StatCalculator
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
 * Loads the latest fragments inventory + offers per-slot ranked
 * picks for the selected combatant, plus the final build stats.
 */
class OptimizerViewModel(app: Application) : AndroidViewModel(app) {

    val charRepo = CharacterRepository(app)
    val setRepo = SetRepository(app)

    data class State(
        val loading: Boolean = false,
        val fragments: List<MemoryFragment> = emptyList(),
        val sourceFile: String? = null,
        val error: String? = null,
        val combatantName: String? = null,
        val filters: OptimizerEngine.Filters = OptimizerEngine.Filters(),
        /** slot → ranked candidates (top N). */
        val candidates: Map<Int, List<MemoryFragment>> = emptyMap(),
        /** slot → user-selected fragment (defaults to top of candidates). */
        val selection: Map<Int, MemoryFragment?> = emptyMap(),
        val finalStats: FinalStats? = null,
    )

    private val _state = MutableStateFlow(State(loading = true))
    val state: StateFlow<State> = _state

    init { reloadInventory() }

    private fun loadFromDisk(): Triple<List<MemoryFragment>, String?, String?> {
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        )
        if (!dir.exists()) {
            return Triple(emptyList(), null, "No CZN-Scanner folder found.")
        }
        val latest = dir.listFiles { f ->
            f.name.startsWith("memory_fragments_android_") && f.name.endsWith(".json")
        }?.maxByOrNull { it.lastModified() }
            ?: return Triple(emptyList(), null, "No memory_fragments_*.json found. Run a Memory Fragments scan first.")
        return try {
            val payload = Json.parseToJsonElement(latest.readText()).jsonObject
            val arr = payload["inventory"]?.jsonObject?.get("piece_items")?.jsonArray
                ?: return Triple(emptyList(), latest.name, "Invalid export format (missing inventory.piece_items).")
            val parser = Json { ignoreUnknownKeys = true }
            Triple(arr.map { parser.decodeFromJsonElement(MemoryFragment.serializer(), it) }, latest.name, null)
        } catch (e: Exception) {
            Triple(emptyList(), latest.name, "Parse error: ${e.message}")
        }
    }

    fun reloadInventory() {
        viewModelScope.launch {
            _state.value = _state.value.copy(loading = true, error = null)
            val (frags, srcName, err) = withContext(Dispatchers.IO) { loadFromDisk() }
            _state.value = _state.value.copy(
                loading = false,
                fragments = frags,
                sourceFile = srcName,
                error = err,
            )
            // Re-run if we already have a combatant selected.
            _state.value.combatantName?.let { runOptimizer(it) }
        }
    }

    fun selectCombatant(name: String) {
        _state.value = _state.value.copy(combatantName = name)
        runOptimizer(name)
    }

    fun setFilters(filters: OptimizerEngine.Filters) {
        _state.value = _state.value.copy(filters = filters)
        _state.value.combatantName?.let { runOptimizer(it) }
    }

    fun selectFragmentForSlot(slot: Int, frag: MemoryFragment?) {
        val newSel = _state.value.selection.toMutableMap()
        newSel[slot] = frag
        recomputeFinal(newSel)
    }

    private fun runOptimizer(charName: String) {
        viewModelScope.launch(Dispatchers.Default) {
            val cands = OptimizerEngine.rank(
                _state.value.fragments,
                _state.value.filters,
                topN = 5,
            )
            // Default selection = top of each slot.
            val defaultSel: Map<Int, MemoryFragment?> = cands.mapValues { it.value.firstOrNull() }
            recomputeFinal(defaultSel, cands)
        }
    }

    private fun recomputeFinal(
        selection: Map<Int, MemoryFragment?>,
        cands: Map<Int, List<MemoryFragment>>? = null,
    ) {
        val charName = _state.value.combatantName ?: return
        val char = charRepo.lookup(charName) ?: return
        val gear = selection.values.filterNotNull()
        val finalStats = StatCalculator.finalStats(char, gear)
        _state.value = _state.value.copy(
            candidates = cands ?: _state.value.candidates,
            selection = selection,
            finalStats = finalStats,
        )
    }
}
