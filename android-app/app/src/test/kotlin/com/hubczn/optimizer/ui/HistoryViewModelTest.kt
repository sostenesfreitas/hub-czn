package com.hubczn.optimizer.ui

import com.hubczn.optimizer.data.local.RescueRecordEntity
import org.junit.Assert.*
import org.junit.Test
import org.robolectric.annotation.Config

class HistoryViewModelTest {

    private fun record(
        name: String = "Akad",
        rarity: Int = 4,
        bannerName: String = "Seasonal Combatant Rescue Rate-Up",
        pullNumber: Long = 1L,
        isFeatured: Boolean = false
    ) = RescueRecordEntity(
        bannerName = bannerName,
        name = name,
        type = "Partners",
        createAt = "2026-04-29 08:16:56",
        rescueType = bannerName,
        isFeatured = isFeatured,
        duplicateIdx = 0,
        resId = 20007,
        rarity = rarity,
        pullNumber = pullNumber
    )

    @Test
    fun `computeStats total is correct`() {
        val records = listOf(record(), record(name = "B"), record(name = "C"))
        val stats = HistoryViewModel.computeStats(records)
        assertEquals(3, stats.total)
    }

    @Test
    fun `computeStats fiveStar count`() {
        val records = listOf(record(rarity = 5), record(rarity = 4), record(rarity = 3))
        val stats = HistoryViewModel.computeStats(records)
        assertEquals(1, stats.fiveStar)
        assertEquals(1, stats.fourStar)
    }

    @Test
    fun `computeStats resourcesSpent is total times 160`() {
        val records = listOf(record(), record(), record())
        val stats = HistoryViewModel.computeStats(records)
        assertEquals(480, stats.resourcesSpent)
    }

    @Test
    fun `computeStats avgPity5 is correct`() {
        // Records in order: 5* at pull 3, then 5* at pull 2 = pities 3 and 2
        val records = (1..3).map { record(rarity = if (it == 3) 5 else 4, pullNumber = it.toLong()) } +
                      (4..5).map { record(rarity = if (it == 5) 5 else 3, pullNumber = it.toLong()) }
        val stats = HistoryViewModel.computeStats(records)
        // Pity resets after 5*: first 5* at pull 3 (pity=3), second at pull 5 (pity=2 since counter resets after first 5*)
        assertEquals(2.5f, stats.avgPity5, 0.01f)
    }

    @Test
    fun `fiveStarRecords returns only rarity 5`() {
        val records = listOf(record(rarity = 5), record(rarity = 4), record(rarity = 5))
        val fiveStars = HistoryViewModel.fiveStarRecords(records)
        assertEquals(2, fiveStars.size)
        assertTrue(fiveStars.all { it.rarity == 5 })
    }
}
