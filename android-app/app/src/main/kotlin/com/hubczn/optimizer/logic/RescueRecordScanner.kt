package com.hubczn.optimizer.logic

import com.hubczn.optimizer.capture.GestureDispatcher
import com.hubczn.optimizer.capture.MLKitOCREngine
import com.hubczn.optimizer.capture.ScreenshotManager
import com.hubczn.optimizer.model.OcrBlock
import com.hubczn.optimizer.model.RescueRecord
import kotlinx.coroutines.delay

class RescueRecordScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    private val selectedBanner: String = "Unknown Banner",
    private val pageLimit: Int? = null,
    private val calibX: Float? = null,
    private val calibY: Float? = null,
    private val onProgress: (String) -> Unit = {}
) {
    private val allRecords = mutableListOf<RescueRecord>()

    suspend fun scan(): List<RescueRecord> {
        allRecords.clear()
        var previousPageRecords: List<RescueRecord>? = null
        var page = 1

        while (true) {
            if (pageLimit != null && page > pageLimit) {
                onProgress("Page limit ($pageLimit) reached.")
                break
            }
            onProgress("Scanning page $page...")
            val bitmap = screenshotManager.capture() ?: break
            val blocks = ocrEngine.recognizeBlocks(bitmap)

            val headerY = findHeaderY(blocks)
            val records = RescueRecordParser.parseTableRows(blocks, selectedBanner, headerY)

            onProgress("Page $page: ${records.size} rows. Texts: ${blocks.take(6).map { it.text }}")

            if (records.isEmpty() || records == previousPageRecords) break
            allRecords.addAll(records)
            previousPageRecords = records

            val nextCoords = findNextButtonCoords(blocks, bitmap.width, bitmap.height)
            if (nextCoords == null) {
                val allTexts = blocks.map { "'${it.text}'" }.joinToString(" | ")
                onProgress("No next btn. All texts: $allTexts")
                break
            }

            val (cx, cy) = nextCoords
            onProgress("Tapping next at (${"%.0f".format(cx)}, ${"%.0f".format(cy)})")
            gestures.tap(cx, cy)

            val currentPageNum = extractPageNumber(blocks, bitmap.width, bitmap.height)
            onProgress("Waiting for page ${page + 1} to load...")
            val loaded = waitForPageChange(currentPageNum, timeoutMs = 10_000L)
            if (!loaded) {
                onProgress("Timeout waiting for page ${page + 1}. Stopping.")
                break
            }
            page++
        }

        onProgress("Done: ${allRecords.size} records")
        return RescueRecordParser.deduplicate(allRecords)
    }

    private fun findNextButtonCoords(blocks: List<OcrBlock>, screenWidth: Int, screenHeight: Int): Pair<Float, Float>? {
        // Option 1: user calibrated the position manually — always use this first
        if (calibX != null && calibY != null) return calibX to calibY

        // Option 2: OCR detected the ">" character directly
        val nextChars = setOf(">", "›", "»", "▶", "→", ">>", "next", "Next")
        val textBlock = blocks.filter { it.text.trim() in nextChars }.maxByOrNull { it.bounds.left }
        if (textBlock != null) return textBlock.bounds.exactCenterX() to textBlock.bounds.exactCenterY()

        // Option 3: find page number in bottom third, tap to its right
        val bottomThird = screenHeight * 2 / 3
        val pageNumBlock = blocks
            .filter { it.bounds.top > bottomThird && it.text.trim().matches(Regex("\\d{1,3}")) }
            .minByOrNull { Math.abs(it.bounds.exactCenterX() - screenWidth / 2f) }

        if (pageNumBlock != null) {
            val slotWidth = pageNumBlock.bounds.height() * 2.8f
            val cx = pageNumBlock.bounds.exactCenterX() + slotWidth
            val cy = pageNumBlock.bounds.exactCenterY()
            return cx to cy
        }

        return null
    }

    private fun extractPageNumber(blocks: List<OcrBlock>, screenWidth: Int, screenHeight: Int): Int? {
        val bottomThird = screenHeight * 2 / 3
        return blocks
            .filter { it.bounds.top > bottomThird && it.text.trim().matches(Regex("\\d{1,3}")) }
            .minByOrNull { Math.abs(it.bounds.exactCenterX() - screenWidth / 2f) }
            ?.text?.trim()?.toIntOrNull()
    }

    private suspend fun waitForPageChange(previousPageNum: Int?, timeoutMs: Long): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        while (System.currentTimeMillis() < deadline) {
            delay(600)
            val bitmap = screenshotManager.capture() ?: continue
            val blocks = ocrEngine.recognizeBlocks(bitmap)
            val newPageNum = extractPageNumber(blocks, bitmap.width, bitmap.height)
            if (newPageNum != null && newPageNum != previousPageNum) return true
            // Also accept if we can't detect a page number but records changed — handled by outer loop
        }
        return false
    }

    private fun findHeaderY(blocks: List<OcrBlock>): Int {
        // Header row contains "Type", "Rescue List", "Rescue Type", "Rescue Time"
        return blocks.firstOrNull { it.text == "Type" || it.text == "Rescue List" }
            ?.bounds?.bottom ?: 0
    }
}
