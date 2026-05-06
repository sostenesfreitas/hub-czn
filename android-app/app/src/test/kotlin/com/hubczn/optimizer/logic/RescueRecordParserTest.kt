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
class RescueRecordParserTest {

    private fun block(text: String, left: Int, top: Int) =
        OcrBlock(text, Rect(left, top, left + 200, top + 30))

    // Simulates one table row at y=200:
    // Type=Partners(left=50) | Name=Akad(left=250) | RescueType=Seasonal...(left=450) | Time=2026-04-29 08:16:56(left=700)
    private fun oneRow(top: Int = 200) = listOf(
        block("Partners",                          left = 50,  top = top),
        block("Akad",                              left = 250, top = top),
        block("Seasonal Combatant Rescue Rate-Up", left = 450, top = top),
        block("2026-04-29 08:16:56",               left = 700, top = top),
    )

    @Test fun `parseTableRows extracts one record from a single row`() {
        val records = RescueRecordParser.parseTableRows(
            blocks = oneRow(),
            bannerName = "Amplified Distress Signal: Heidemarie",
            headerY = 150
        )
        assertEquals(1, records.size)
        assertEquals("Partners", records[0].type)
        assertEquals("Akad", records[0].name)
        assertEquals("Seasonal Combatant Rescue Rate-Up", records[0].rescueType)
        assertEquals("2026-04-29 08:16:56", records[0].createAt)
        assertEquals("Amplified Distress Signal: Heidemarie", records[0].bannerName)
        assertEquals("pickup_combatant", records[0].gachaId)
    }

    @Test fun `inferGachaId returns pickup_combatant for seasonal combatant banner`() {
        assertEquals("pickup_combatant",
            RescueRecordParser.inferGachaId("Seasonal Combatant Rescue Rate-Up"))
    }

    @Test fun `inferGachaId returns pickup_partner for seasonal partner banner`() {
        assertEquals("pickup_partner",
            RescueRecordParser.inferGachaId("Seasonal Partner Rescue Rate-Up"))
    }

    @Test fun `inferGachaId returns standard for standard banner`() {
        assertEquals("standard",
            RescueRecordParser.inferGachaId("Standard Rescue"))
    }

    @Test fun `deduplicateRecords removes exact duplicates`() {
        val records = RescueRecordParser.parseTableRows(
            blocks = oneRow(200) + oneRow(200),
            bannerName = "Banner",
            headerY = 150
        )
        val deduped = RescueRecordParser.deduplicate(records)
        assertEquals(1, deduped.size)
    }
}
