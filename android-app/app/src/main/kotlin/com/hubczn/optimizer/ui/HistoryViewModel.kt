package com.hubczn.optimizer.ui

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.hubczn.optimizer.data.local.RescueRecordDatabase
import com.hubczn.optimizer.data.local.RescueRecordEntity
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

    private val _records = MutableStateFlow<List<RescueRecordEntity>>(emptyList())
    val records: StateFlow<List<RescueRecordEntity>> = _records

    private val _selectedBannerIdx = MutableStateFlow(0)
    val selectedBannerIdx: StateFlow<Int> = _selectedBannerIdx

    val bannerNames = listOf(
        "Seasonal Combatant Rescue Rate-Up",
        "Gacha General",
        "Gacha Pickup Supporter"
    )

    init {
        loadRecords()
    }

    fun selectBanner(idx: Int) { _selectedBannerIdx.value = idx }

    private fun loadRecords() {
        viewModelScope.launch {
            _records.value = dao.getAllOrderedByPullNumber()
        }
    }

    fun refresh() = loadRecords()

    fun recordsForBanner(bannerIdx: Int): List<RescueRecordEntity> {
        val name = bannerNames.getOrNull(bannerIdx) ?: return emptyList()
        return _records.value.filter { it.bannerName == name }
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
