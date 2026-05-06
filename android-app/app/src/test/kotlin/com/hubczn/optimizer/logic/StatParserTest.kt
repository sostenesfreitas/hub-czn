package com.hubczn.optimizer.logic

import org.junit.Assert.*
import org.junit.Test

class StatParserTest {

    @Test fun `parseStatName returns name without roll marker`() {
        val (name, rolls) = StatParser.parseStatName("Attack")
        assertEquals("Attack", name)
        assertEquals(0, rolls)
    }

    @Test fun `parseStatName strips roll count from name`() {
        val (name, rolls) = StatParser.parseStatName("Health +2")
        assertEquals("Health", name)
        assertEquals(2, rolls)
    }

    @Test fun `parseStatName handles multi-word stat`() {
        val (name, rolls) = StatParser.parseStatName("Critical Chance")
        assertEquals("Critical Chance", name)
        assertEquals(0, rolls)
    }

    @Test fun `parseStatName handles multi-word stat with rolls`() {
        val (name, rolls) = StatParser.parseStatName("Critical Damage +3")
        assertEquals("Critical Damage", name)
        assertEquals(3, rolls)
    }

    @Test fun `parseStatValue flat with plus sign`() {
        val (value, type) = StatParser.parseStatValue("+22")!!
        assertEquals(22.0, value, 0.001)
        assertEquals("flat", type)
    }

    @Test fun `parseStatValue flat without plus sign`() {
        val (value, type) = StatParser.parseStatValue("31")!!
        assertEquals(31.0, value, 0.001)
        assertEquals("flat", type)
    }

    @Test fun `parseStatValue percent without plus`() {
        val (value, type) = StatParser.parseStatValue("1%")!!
        assertEquals(1.0, value, 0.001)
        assertEquals("percent", type)
    }

    @Test fun `parseStatValue percent with plus`() {
        val (value, type) = StatParser.parseStatValue("+1.6%")!!
        assertEquals(1.6, value, 0.001)
        assertEquals("percent", type)
    }

    @Test fun `parseStatValue decimal percent`() {
        val (value, type) = StatParser.parseStatValue("2.6%")!!
        assertEquals(2.6, value, 0.001)
        assertEquals("percent", type)
    }

    @Test fun `parseStatValue returns null for garbage input`() {
        assertNull(StatParser.parseStatValue("Set Effect"))
    }
}
