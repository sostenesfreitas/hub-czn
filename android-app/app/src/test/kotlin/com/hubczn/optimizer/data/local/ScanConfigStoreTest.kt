package com.hubczn.optimizer.data.local

import android.app.Application
import androidx.test.core.app.ApplicationProvider
import org.junit.Assert.*
import org.junit.Before
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [33])
class ScanConfigStoreTest {
    private lateinit var store: ScanConfigStore

    @Before
    fun setUp() {
        val ctx = ApplicationProvider.getApplicationContext<Application>()
        store = ScanConfigStore(ctx)
    }

    @Test
    fun `calib coords default to null`() {
        assertNull(store.calibRescueX)
        assertNull(store.calibRescueY)
        assertNull(store.calibFragmentsX)
        assertNull(store.calibCombatantsX)
    }

    @Test
    fun `calib coords round-trip`() {
        store.calibRescueX = 123.5f
        store.calibRescueY = 456.0f
        assertEquals(123.5f, store.calibRescueX)
        assertEquals(456.0f, store.calibRescueY)
    }

    @Test
    fun `language override default null`() {
        assertNull(store.languageOverride)
    }

    @Test
    fun `language override round-trip`() {
        store.languageOverride = "pt"
        assertEquals("pt", store.languageOverride)
        store.languageOverride = null
        assertNull(store.languageOverride)
    }

    @Test
    fun `lastBannerIndex defaults to 0`() {
        assertEquals(0, store.lastBannerIndex)
    }

    @Test
    fun `lastBannerIndex round-trip`() {
        store.lastBannerIndex = 2
        assertEquals(2, store.lastBannerIndex)
    }
}
