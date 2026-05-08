package com.hubczn.optimizer.ui

import android.app.Application
import android.os.Environment
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hubczn.optimizer.data.local.CombatantOverridesStore
import com.hubczn.optimizer.data.repository.CharacterRepository
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.CombatantStats
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
 * Loads the most recent `combatants_*.json` snapshot exported by
 * [com.hubczn.optimizer.capture.CaptureService] and exposes it as a list of
 * [Combatant] for the UI. Pure read-only: no DB.
 */
class CombatantsViewModel(app: Application) : AndroidViewModel(app) {

    val charRepo = CharacterRepository(app)
    val setRepo = com.hubczn.optimizer.data.repository.SetRepository(app)
    private val overrides = CombatantOverridesStore(app)

    private val _state = MutableStateFlow(State(loading = true))
    val state: StateFlow<State> = _state

    data class State(
        val loading: Boolean = false,
        val combatants: List<Combatant> = emptyList(),
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
        val latest = dir.listFiles { f -> f.name.startsWith("combatants_android_") && f.name.endsWith(".json") }
            ?.maxByOrNull { it.lastModified() }
            ?: return State(error = "No combatants_*.json export found. Run a Combatants scan first.")

        return try {
            val payload = Json.parseToJsonElement(latest.readText()).jsonObject
            val arr = payload["combatants"]?.jsonArray ?: return State(error = "Invalid export format.")
            val ovr = overrides.load()
            val combatants = arr.map { el ->
                val base = Json { ignoreUnknownKeys = true }
                    .decodeFromJsonElement(Combatant.serializer(), el)
                val o = ovr[base.name] ?: return@map base
                // Apply per-slot fragment overrides, replacing OCR
                // values for the slots the user has corrected.
                val mergedFrags = if (o.fragments.isEmpty()) {
                    base.equippedFragments
                } else {
                    val byOcr = base.equippedFragments.associateBy { it.slotNum }.toMutableMap()
                    for ((slot, frag) in o.fragments) byOcr[slot] = frag
                    byOcr.values.sortedBy { it.slotNum }
                }
                base.copy(
                    ego = o.ego ?: base.ego,
                    stats = o.stats ?: base.stats,
                    equippedFragments = mergedFrags,
                )
            }
            State(combatants = combatants, sourceFile = latest.name)
        } catch (e: Exception) {
            State(error = "Parse error: ${e.message}")
        }
    }

    /**
     * Persists a manual ego override for [combatantName] and refreshes
     * the in-memory state so the UI updates immediately. Pass null to
     * clear the override (revert to whatever the OCR scan captured).
     */
    fun setEgoOverride(combatantName: String, ego: Int?) {
        viewModelScope.launch(Dispatchers.IO) {
            overrides.setEgo(combatantName, ego)
            updateInMemory(combatantName) { it.copy(ego = ego ?: 0) }
        }
    }

    /**
     * Replaces the combatant's full stats block. Pass null to clear
     * the override and revert to the OCR-captured values.
     */
    fun setStatsOverride(combatantName: String, stats: CombatantStats?) {
        viewModelScope.launch(Dispatchers.IO) {
            overrides.setStats(combatantName, stats)
            updateInMemory(combatantName) {
                it.copy(stats = stats ?: it.stats)
            }
        }
    }

    /**
     * Replaces (or clears with null) the fragment in [slotNum] for
     * [combatantName]. Other slots' fragments are untouched.
     */
    fun setFragmentOverride(combatantName: String, slotNum: Int, fragment: MemoryFragment?) {
        viewModelScope.launch(Dispatchers.IO) {
            overrides.setFragment(combatantName, slotNum, fragment)
            updateInMemory(combatantName) { c ->
                val rest = c.equippedFragments.filter { it.slotNum != slotNum }
                val merged = if (fragment == null) rest else (rest + fragment)
                c.copy(equippedFragments = merged.sortedBy { it.slotNum })
            }
        }
    }

    private fun updateInMemory(name: String, transform: (Combatant) -> Combatant) {
        val newCombatants = _state.value.combatants.map {
            if (it.name == name) transform(it) else it
        }
        _state.value = _state.value.copy(combatants = newCombatants)
    }
}
