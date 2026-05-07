package com.hubczn.optimizer.data.local

import android.app.Application
import androidx.room.Room
import androidx.test.core.app.ApplicationProvider
import kotlinx.coroutines.test.runTest
import org.junit.After
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [33])
class RescueRecordDaoTest {
    private lateinit var db: RescueRecordDatabase
    private lateinit var dao: RescueRecordDao

    @Before
    fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        db = Room.inMemoryDatabaseBuilder(ctx, RescueRecordDatabase::class.java)
            .allowMainThreadQueries()
            .build()
        dao = db.rescueRecordDao()
    }

    @After
    fun tearDown() { db.close() }

    private fun record(
        name: String = "Akad",
        bannerName: String = "Seasonal Combatant Rescue Rate-Up",
        createAt: String = "2026-04-29 08:16:56",
        duplicateIdx: Int = 0,
        pullNumber: Long = 1L
    ) = RescueRecordEntity(
        bannerName = bannerName,
        name = name,
        type = "Partners",
        createAt = createAt,
        rescueType = "Seasonal Combatant Rescue Rate-Up",
        isFeatured = false,
        duplicateIdx = duplicateIdx,
        resId = 20007,
        rarity = 4,
        pullNumber = pullNumber
    )

    @Test
    fun `insert and retrieve by banner`() = runTest {
        dao.upsert(record())
        val results = dao.getByBanner("Seasonal Combatant Rescue Rate-Up")
        assertEquals(1, results.size)
        assertEquals("Akad", results[0].name)
    }

    @Test
    fun `duplicate insert is ignored`() = runTest {
        dao.upsert(record())
        dao.upsert(record()) // same unique key
        val results = dao.getByBanner("Seasonal Combatant Rescue Rate-Up")
        assertEquals(1, results.size)
    }

    @Test
    fun `same name same time different duplicateIdx are distinct`() = runTest {
        dao.upsert(record(duplicateIdx = 0, pullNumber = 1))
        dao.upsert(record(duplicateIdx = 1, pullNumber = 2))
        val results = dao.getByBanner("Seasonal Combatant Rescue Rate-Up")
        assertEquals(2, results.size)
    }

    @Test
    fun `countDuplicates returns correct count`() = runTest {
        dao.upsert(record(duplicateIdx = 0))
        dao.upsert(record(duplicateIdx = 1))
        val count = dao.countDuplicates(
            bannerName = "Seasonal Combatant Rescue Rate-Up",
            name = "Akad",
            type = "Partners",
            createAt = "2026-04-29 08:16:56",
            rescueType = "Seasonal Combatant Rescue Rate-Up",
            isFeatured = false
        )
        assertEquals(2, count)
    }

    @Test
    fun `maxPullNumber returns 0 when empty`() = runTest {
        assertEquals(0L, dao.maxPullNumber())
    }

    @Test
    fun `maxPullNumber returns highest value`() = runTest {
        dao.upsert(record(pullNumber = 10L))
        dao.upsert(record(name = "Yuri", pullNumber = 20L))
        assertEquals(20L, dao.maxPullNumber())
    }

    @Test
    fun `getAllOrderedByPullNumber returns ascending order`() = runTest {
        dao.upsert(record(name = "Yuri", pullNumber = 2L))
        dao.upsert(record(name = "Akad", pullNumber = 1L))
        val all = dao.getAllOrderedByPullNumber()
        assertEquals("Akad", all[0].name)
        assertEquals("Yuri", all[1].name)
    }
}
