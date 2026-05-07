package com.hubczn.optimizer.model

import kotlinx.serialization.json.Json
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

class CombatantSerializationTest {

    private val json = Json { encodeDefaults = true }

    @Test fun `serializes combatant with embedded fragment list`() {
        val frag = MemoryFragment(
            id = 0, slotNum = 1, setName = "Executioner's Tool",
            rarity = "Legendary", rarityNum = 5, level = 5,
            locked = false, equippedCharName = "Heidemarie",
            statList = listOf(
                StatEntry(slot = 0, stat = "Attack", type = "flat", value = 22.0, extraRolls = 0)
            )
        )
        val c = Combatant(
            name = "Heidemarie", level = 60, maxLevel = 60, stars = 5,
            stats = CombatantStats(1052.0, 184.0, 514.0, 36.8, 237.0),
            equippedFragments = listOf(frag)
        )
        val str = json.encodeToString(Combatant.serializer(), c)
        assertTrue(str.contains("\"equipped_fragments\""))
        assertTrue(str.contains("\"set_name\":\"Executioner's Tool\""))

        val round = json.decodeFromString(Combatant.serializer(), str)
        assertEquals(1, round.equippedFragments.size)
        assertEquals("Executioner's Tool", round.equippedFragments[0].setName)
    }
}
