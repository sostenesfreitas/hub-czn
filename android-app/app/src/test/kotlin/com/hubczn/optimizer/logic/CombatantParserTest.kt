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
class CombatantParserTest {

    private fun block(text: String, top: Int, left: Int = 0) =
        OcrBlock(text, Rect(left, top, left + 300, top + 30))

    // Simulates the Stats screen for Heidemarie
    private val statsBlocks = listOf(
        block("Heidemarie",   top = 50,  left = 800),
        block("Lv. 60/60",   top = 100, left = 800),
        block("Attack",       top = 300, left = 800),
        block("1052",         top = 300, left = 1000),
        block("Defense",      top = 340, left = 800),
        block("184",          top = 340, left = 1000),
        block("Health",       top = 380, left = 800),
        block("514",          top = 380, left = 1000),
        block("Critical Chance", top = 420, left = 800),
        block("36.8%",        top = 420, left = 1000),
        block("Critical Damage", top = 460, left = 800),
        block("237.0%",       top = 460, left = 1000),
    )

    @Test fun `parseStats extracts all five stats`() {
        val combatant = CombatantParser.parseStats(statsBlocks)
        assertNotNull(combatant)
        assertEquals("Heidemarie", combatant!!.name)
        assertEquals(60, combatant.level)
        assertEquals(60, combatant.maxLevel)
        assertEquals(1052.0, combatant.stats.attack, 0.001)
        assertEquals(184.0, combatant.stats.defense, 0.001)
        assertEquals(514.0, combatant.stats.health, 0.001)
        assertEquals(36.8, combatant.stats.criticalChance, 0.001)
        assertEquals(237.0, combatant.stats.criticalDamage, 0.001)
    }

    @Test fun `parseLevel extracts level and max from Lv 60 slash 60`() {
        val (level, max) = CombatantParser.parseLevel("Lv. 60/60")
        assertEquals(60, level)
        assertEquals(60, max)
    }

    @Test fun `parseLevel returns zeros for bad input`() {
        val (level, max) = CombatantParser.parseLevel("Stats")
        assertEquals(0, level)
        assertEquals(0, max)
    }
}
