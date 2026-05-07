package com.hubczn.optimizer.logic

import android.graphics.Rect
import com.hubczn.optimizer.model.OcrBlock
import org.junit.Assert.*
import org.junit.Test
import org.junit.runner.RunWith
import org.robolectric.RobolectricTestRunner
import org.robolectric.annotation.Config

@RunWith(RobolectricTestRunner::class)
@Config(manifest = Config.NONE, sdk = [33])
class CombatantSidebarTest {

    private fun block(text: String, top: Int, left: Int = 0, w: Int = 200, h: Int = 30) =
        OcrBlock(text, Rect(left, top, left + w, top + h))

    @Test fun `findTab returns the tap target for the requested label`() {
        val blocks = listOf(
            block("Stats",            top = 400, left = 130),
            block("Cards",            top = 470, left = 130),
            block("Memory Fragments", top = 740, left = 130),
            block("Ego Manifestation",top = 810, left = 130),
        )
        val mf = CombatantSidebar.findTab(blocks, "Memory Fragments")
        assertNotNull(mf)
        assertEquals(230f, mf!!.first, 0.5f)  // left + w/2
        assertEquals(755f, mf.second, 0.5f)   // top + h/2

        assertNull(CombatantSidebar.findTab(blocks, "Nonexistent Tab"))
    }

    @Test fun `findSlotTapTargets returns coords for all six Roman numerals`() {
        // Slot icons live above their numeral. We tap on the numeral
        // bounds directly because the icon center is consistently within
        // ~80dp above and clicking the numeral selects the slot reliably.
        val blocks = listOf(
            block("I",   top = 660, left = 380, w = 40, h = 30),
            block("II",  top = 470, left = 360, w = 40, h = 30),
            block("III", top = 290, left = 530, w = 50, h = 30),
            block("IV",  top = 290, left = 700, w = 50, h = 30),
            block("V",   top = 470, left = 850, w = 40, h = 30),
            block("VI",  top = 660, left = 850, w = 40, h = 30),
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertEquals(6, targets.size)
        assertEquals(400f, targets[1]!!.first,  0.5f) // 380 + 40/2
        assertEquals(380f, targets[2]!!.first,  0.5f) // II
        assertEquals(555f, targets[3]!!.first,  0.5f) // III
        assertEquals(725f, targets[4]!!.first,  0.5f) // IV
        assertEquals(870f, targets[5]!!.first,  0.5f) // V
        assertEquals(870f, targets[6]!!.first,  0.5f) // VI
    }

    @Test fun `findSlotTapTargets handles missing slots`() {
        val blocks = listOf(
            block("I",  top = 660, left = 380, w = 40, h = 30),
            block("VI", top = 660, left = 850, w = 40, h = 30),
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertEquals(2, targets.size)
        assertTrue(targets.containsKey(1))
        assertTrue(targets.containsKey(6))
        assertFalse(targets.containsKey(3))
    }
}
