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
        assertEquals(400f, targets[1]!!.x,  0.5f) // 380 + 40/2
        assertEquals(380f, targets[2]!!.x,  0.5f) // II
        assertEquals(555f, targets[3]!!.x,  0.5f) // III
        assertEquals(725f, targets[4]!!.x,  0.5f) // IV
        assertEquals(870f, targets[5]!!.x,  0.5f) // V
        assertEquals(870f, targets[6]!!.x,  0.5f) // VI
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

    @Test fun `findSlotTapTargets marks slot filled when plus-N badge sits below the icon`() {
        // Type-label primary path: "Shock" label at top=720 → icon center
        // computed as 720 - 70 = 650. The "+5" badge for a filled slot
        // sits ~60px below the icon center (between icon and the label).
        val blocks = listOf(
            block("Shock", top = 720, left = 380, w = 80, h = 30),
            block("+5",    top = 700, left = 405, w = 30, h = 25),
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertEquals(1, targets.size)
        assertTrue("Slot 1 must be marked filled when +5 badge is present", targets[1]!!.filled)
    }

    @Test fun `findSlotTapTargets marks slot empty when no badge and a big centered Roman numeral`() {
        // Empty slot: the Roman numeral renders LARGE (h>=60) and centered
        // inside the slot circle — that is the strongest negative signal
        // we have for "this slot is empty". Combined with the absence of
        // a "+N" badge, this conclusively marks the slot empty.
        val blocks = listOf(
            block("Imagination", top = 720, left = 800, w = 130, h = 30),
            block("VI",          top = 600, left = 820, w = 60,  h = 80),
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertFalse(
            "Slot 6 must be marked empty when there is no badge and the numeral is big",
            targets[6]!!.filled
        )
    }

    @Test fun `findSlotTapTargets defaults to filled when no badge and no big numeral signal`() {
        // OCR sometimes drops the small "+N" badge entirely on a filled
        // slot (the badge is small and low-contrast). When the only
        // negative signal — a big centered numeral — is also absent,
        // we MUST default to "filled" and let the cross-combatant dedup
        // pass weed out any phantoms. Defaulting to "empty" caused real
        // slots to be silently dropped on combatants whose badges OCR
        // poorly (Heidemarie regression).
        val blocks = listOf(
            block("Shock", top = 720, left = 380, w = 80, h = 30),
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertTrue(
            "Slot 1 must be marked filled when no signals fire — uncertain → tap, dedup decides",
            targets[1]!!.filled
        )
    }

    @Test fun `findSlotTapTargets does not associate plus-N from a different slot row`() {
        // Two slots in different rows: a "+5" near the bottom-row slot
        // must not falsely mark the top-row slot as filled. Slot 3 is
        // empty, so we include the big "III" numeral that empty slots
        // render centered in the circle (the negative signal).
        val blocks = listOf(
            block("Denial", top = 350, left = 530, w = 80, h = 30),  // top row, EMPTY
            block("III",    top = 230, left = 540, w = 60, h = 80),  // empty -> big numeral
            block("Shock",  top = 720, left = 405, w = 80, h = 30),  // bottom row, filled
            block("+5",     top = 700, left = 420, w = 30, h = 25),  // belongs to Shock
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertEquals(2, targets.size)
        assertFalse("Slot 3 (Denial) is empty — must not steal slot 1's badge", targets[3]!!.filled)
        assertTrue("Slot 1 (Shock) must be marked filled", targets[1]!!.filled)
    }

    @Test fun `findSlotTapTargets detects fill via Roman numeral fallback path`() {
        // No type labels OCR'd this round — only the numeral. The fill
        // detection must still work off the Roman-numeral tap target.
        val blocks = listOf(
            block("II", top = 470, left = 360, w = 40, h = 30),
            block("+3", top = 540, left = 380, w = 30, h = 25),
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertEquals(1, targets.size)
        assertTrue(targets[2]!!.filled)
    }

    @Test fun `findSlotTapTargets accepts badge merged with adjacent glyph`() {
        // ML Kit sometimes merges the "+5" badge with the small set-icon
        // glyph that sits next to it ("+5 K", "+10 X", trailing space).
        // The fill detector must accept these — a strict full-match
        // regex would reject them and falsely skip the slot.
        val blocks = listOf(
            block("Shock", top = 720, left = 380, w = 80, h = 30),
            block("+5 X",  top = 700, left = 405, w = 60, h = 25),
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertTrue(
            "Slot 1 must be marked filled when the badge is merged with the icon glyph",
            targets[1]!!.filled
        )
    }

    @Test fun `findSlotTapTargets does not treat percent values as badges`() {
        // The Set Effect description on the right panel ("+25% Critical
        // Damage") starts with "+\d+" but is not a slot upgrade badge.
        // It must NOT be picked up as a fill marker, even when its X
        // happens to fall within the badge tolerance of a slot icon.
        // The big "VI" numeral is what conclusively flags this slot
        // empty (the % filter alone leaves us in the uncertain default).
        val blocks = listOf(
            block("Imagination",          top = 720, left = 800, w = 130, h = 30),
            block("VI",                   top = 600, left = 820, w = 60,  h = 80),
            block("+25% Critical Damage", top = 700, left = 820, w = 220, h = 25),
        )
        val targets = CombatantSidebar.findSlotTapTargets(blocks)
        assertFalse(
            "Slot 6 is empty — Set-Effect '+25%' text must not be confused with the upgrade badge",
            targets[6]!!.filled
        )
    }
}
