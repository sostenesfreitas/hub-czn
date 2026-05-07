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

    // Simulates the right panel for Heidemarie's Slot I (Executioner's Tool Shock).
    // The right panel only fills the right ~30% of the screen, so all blocks
    // have left >= ~900 in our 1280-wide mock.
    private val panelBlocks = listOf(
        block("Legendary",          top = 270, left = 940),
        block("+5",                 top = 270, left = 1080),
        block("Executioner's Tool", top = 320, left = 940),
        block("Shock",              top = 320, left = 1130),
        block("Attack",             top = 370, left = 940),
        block("+22",                top = 370, left = 1200),
        block("Defense",            top = 410, left = 940),
        block("0.9%",               top = 410, left = 1200),
        block("Extra Damage +1",    top = 450, left = 940),
        block("+6.6%",              top = 450, left = 1200),
        block("Critical Chance +2", top = 490, left = 940),
        block("+5.3%",              top = 490, left = 1200),
        block("Critical Damage +1", top = 530, left = 940),
        block("+5.8%",              top = 530, left = 1200),
        block("Set Effect",         top = 575, left = 940),
        block("Executioner's Tool (2)", top = 620, left = 940),
        block("2 Set: +25% Critical Damage", top = 660, left = 940),
    )

    @Test fun `parseFragmentPanel extracts set, rarity, level and stats`() {
        val frag = CombatantParser.parseFragmentPanel(
            blocks = panelBlocks,
            slotNum = 1,
            equippedCharName = "Heidemarie"
        )
        assertNotNull(frag)
        assertEquals("Executioner's Tool", frag!!.setName)
        assertEquals("Legendary", frag.rarity)
        assertEquals(5, frag.rarityNum)
        assertEquals(5, frag.level)
        assertEquals(1, frag.slotNum)
        assertEquals("Heidemarie", frag.equippedCharName)

        // First entry is main stat (Attack +22, flat)
        val main = frag.statList[0]
        assertEquals("Attack", main.stat)
        assertEquals("flat", main.type)
        assertEquals(22.0, main.value, 0.001)

        // Sub-stats include the Critical Chance with extraRolls=2
        val cc = frag.statList.firstOrNull { it.stat == "Critical Chance" }
        assertNotNull(cc)
        assertEquals(2, cc!!.extraRolls)
        assertEquals(5.3, cc.value, 0.001)
        assertEquals("percent", cc.type)
    }

    @Test fun `parseFragmentPanel returns null for empty slot`() {
        val emptyBlocks = listOf(
            block("Set Effect", top = 575, left = 940)
            // No rarity, no title — empty equipped slot
        )
        assertNull(CombatantParser.parseFragmentPanel(emptyBlocks, slotNum = 3, equippedCharName = "X"))
    }
}
