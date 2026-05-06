package com.hubczn.optimizer.logic

import com.hubczn.optimizer.capture.GestureDispatcher
import com.hubczn.optimizer.capture.MLKitOCREngine
import com.hubczn.optimizer.capture.ScreenshotManager
import com.hubczn.optimizer.model.OcrBlock
import com.hubczn.optimizer.model.RescueRecord

class RescueRecordScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    private val onProgress: (String) -> Unit = {}
) {
    private val allRecords = mutableListOf<RescueRecord>()

    suspend fun scan(): List<RescueRecord> {
        allRecords.clear()
        var previousPageRecords: List<RescueRecord>? = null
        var page = 1

        while (true) {
            onProgress("Scanning page $page...")
            val bitmap = screenshotManager.capture() ?: break
            val blocks = ocrEngine.recognizeBlocks(bitmap)

            val bannerName = extractBannerName(blocks)
            val headerY = findHeaderY(blocks)
            val records = RescueRecordParser.parseTableRows(blocks, bannerName, headerY)

            if (records.isEmpty() || records == previousPageRecords) break
            allRecords.addAll(records)
            previousPageRecords = records

            // Find ">" button (next page) — rightmost ">" text in bottom half of screen
            val nextButton = blocks
                .filter { it.text == ">" && it.bounds.top > bitmap.height / 2 }
                .maxByOrNull { it.bounds.left }

            if (nextButton == null) break

            val cx = nextButton.bounds.exactCenterX()
            val cy = nextButton.bounds.exactCenterY()
            gestures.tap(cx, cy)
            page++
        }

        onProgress("Done: ${allRecords.size} records")
        return RescueRecordParser.deduplicate(allRecords)
    }

    private fun extractBannerName(blocks: List<OcrBlock>): String {
        // Banner name is typically near the top of the modal, after "Amplified Distress Signal:"
        return blocks
            .sortedBy { it.bounds.top }
            .firstOrNull { it.text.contains("Signal") || it.text.contains("Banner") }
            ?.text ?: "Unknown Banner"
    }

    private fun findHeaderY(blocks: List<OcrBlock>): Int {
        // Header row contains "Type", "Rescue List", "Rescue Type", "Rescue Time"
        return blocks.firstOrNull { it.text == "Type" || it.text == "Rescue List" }
            ?.bounds?.bottom ?: 0
    }
}
