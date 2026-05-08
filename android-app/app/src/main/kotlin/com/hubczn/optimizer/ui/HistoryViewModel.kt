package com.hubczn.optimizer.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hubczn.optimizer.data.local.RescueRecordDatabase
import com.hubczn.optimizer.data.local.RescueRecordEntity
import com.hubczn.optimizer.data.local.ScanConfigStore
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

data class BannerStats(
    val total: Int,
    val fiveStar: Int,
    val fourStar: Int,
    val resourcesSpent: Int,
    val avgPity5: Float,
    val avgPity4: Float
)

class HistoryViewModel(app: Application) : AndroidViewModel(app) {
    private val dao = RescueRecordDatabase.getInstance(app).rescueRecordDao()
    private val configStore = ScanConfigStore(app)

    private val _records = MutableStateFlow<List<RescueRecordEntity>>(emptyList())
    val records: StateFlow<List<RescueRecordEntity>> = _records

    private val _selectedBannerIdx = MutableStateFlow(configStore.lastBannerIndex)
    val selectedBannerIdx: StateFlow<Int> = _selectedBannerIdx

    val bannerNames = listOf(
        "Seasonal Combatant Rescue Rate-Up",
        "Seasonal Partner Rescue Rate-Up",
        "Gacha General",
        "Gacha Pickup Supporter"
    )

    init {
        android.util.Log.i("CZNScanner", "HistoryVM init: selectedBannerIdx=${_selectedBannerIdx.value}, bannerNames=$bannerNames")
        loadRecords()
    }

    fun selectBanner(idx: Int) {
        android.util.Log.i("CZNScanner", "HistoryVM selectBanner($idx) -> '${bannerNames.getOrNull(idx)}'")
        _selectedBannerIdx.value = idx
    }

    private fun loadRecords() {
        viewModelScope.launch {
            // Renumber pullNumber by chronological order — corrects past
            // out-of-order inserts from multi-pass scans (older pulls captured
            // after newer ones). Non-destructive.
            //
            // We deliberately do NOT run deleteDuplicatesByNaturalKey() here:
            // legitimate batch duplicates (10-pull with 2+ identical chars at
            // the same timestamp) share the natural key and would be wiped on
            // every history open, conflicting with the per-scan dedup logic
            // in CaptureService.
            dao.renumberPullNumbersByCreateAt()
            val all = dao.getAllOrderedByPullNumber()
            val byBanner = all.groupingBy { it.bannerName }.eachCount()
            android.util.Log.i("CZNScanner", "HistoryVM loadRecords: total=${all.size}, byBanner=$byBanner")
            _records.value = all
        }
    }

    fun refresh() = loadRecords()

    fun recordsForBanner(bannerIdx: Int): List<RescueRecordEntity> {
        val name = bannerNames.getOrNull(bannerIdx) ?: return emptyList()
        val matches = _records.value.filter { it.bannerName == name }
        android.util.Log.i("CZNScanner", "HistoryVM recordsForBanner($bannerIdx -> '$name'): ${matches.size}/${_records.value.size}")
        return matches
    }

    companion object {
        fun computeStats(records: List<RescueRecordEntity>): BannerStats {
            var pity5Counter = 0
            var pity4Counter = 0
            val pities5 = mutableListOf<Int>()
            val pities4 = mutableListOf<Int>()

            for (r in records.sortedBy { it.pullNumber }) {
                pity5Counter++
                pity4Counter++
                when (r.rarity) {
                    5 -> { pities5.add(pity5Counter); pity5Counter = 0 }
                    4 -> { pities4.add(pity4Counter); pity4Counter = 0 }
                }
            }

            return BannerStats(
                total = records.size,
                fiveStar = records.count { it.rarity == 5 },
                fourStar = records.count { it.rarity == 4 },
                resourcesSpent = records.size * 160,
                avgPity5 = if (pities5.isEmpty()) 0f else pities5.average().toFloat(),
                avgPity4 = if (pities4.isEmpty()) 0f else pities4.average().toFloat()
            )
        }

        fun fiveStarRecords(records: List<RescueRecordEntity>): List<RescueRecordEntity> =
            records.filter { it.rarity == 5 }.sortedByDescending { it.pullNumber }

        /** Returns a map of record.id → pity value (pulls since last 5★, inclusive). */
        fun computePityMap(records: List<RescueRecordEntity>): Map<Long, Int> {
            val result = mutableMapOf<Long, Int>()
            var pity = 0
            for (r in records.sortedBy { it.pullNumber }) {
                pity++
                result[r.id] = pity
                if (r.rarity == 5) pity = 0
            }
            return result
        }
    }
}
