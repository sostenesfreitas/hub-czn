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
class FragmentParserTest {

    private fun block(text: String, top: Int, left: Int = 0) =
        OcrBlock(text, Rect(left, top, left + 200, top + 30))

    @Test fun `parseRarity maps Legendary to 5`() {
        assertEquals(5, FragmentParser.parseRarity("Legendary"))
    }

    @Test fun `parseRarity maps Epic to 4`() {
        assertEquals(4, FragmentParser.parseRarity("Epic"))
    }

    @Test fun `parseRarity returns 0 for unknown`() {
        assertEquals(0, FragmentParser.parseRarity("Unknown"))
    }

    @Test fun `parseSlot maps roman numeral I to 1`() {
        assertEquals(1, FragmentParser.parseSlot("I"))
    }

    @Test fun `parseSlot maps roman numeral VI to 6`() {
        assertEquals(6, FragmentParser.parseSlot("VI"))
    }

    @Test fun `parseSlot returns 0 for unknown`() {
        assertEquals(0, FragmentParser.parseSlot("X"))
    }

    @Test fun `parseUpgradeLevel extracts number from +5`() {
        assertEquals(5, FragmentParser.parseUpgradeLevel("+5"))
    }

    @Test fun `parseUpgradeLevel returns 0 for no match`() {
        assertEquals(0, FragmentParser.parseUpgradeLevel("Upgrade"))
    }

    @Test fun `parseStats separates main stat from substats by Y position`() {
        val blocks = listOf(
            block("Attack",          top = 100),  // main stat name
            block("+22",             top = 100),  // main stat value
            block("Health",          top = 140),  // substat 1 name
            block("1%",              top = 140),  // substat 1 value
            block("Health +2",       top = 180),  // substat 2 name
            block("+31",             top = 180),  // substat 2 value
            block("Attack +2",       top = 220),  // substat 3 name
            block("2.6%",            top = 220),  // substat 3 value
            block("Critical Chance", top = 260),  // substat 4 name
            block("+1.6%",           top = 260),  // substat 4 value
        )
        val stats = FragmentParser.parseStats(blocks)
        assertEquals(5, stats.size)
        assertEquals(0, stats[0].slot)       // main stat
        assertEquals("Attack", stats[0].stat)
        assertEquals("flat", stats[0].type)
        assertEquals(22.0, stats[0].value, 0.001)
        assertEquals(1, stats[1].slot)       // first substat
        assertEquals("Health", stats[1].stat)
        assertEquals("percent", stats[1].type)
        assertEquals(1.0, stats[1].value, 0.001)
        assertEquals(2, stats[2].extraRolls)  // Health +2
        assertEquals(2, stats[3].extraRolls)  // Attack +2
        assertEquals(0, stats[4].extraRolls)  // Critical Chance
    }
}
