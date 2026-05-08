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
    private val onProgress: (String) -> Unit = {},
    private val saveDebugBitmap: ((android.graphics.Bitmap, String) -> Unit)? = null
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
            val bitmap = screenshotManager.capture()
            if (bitmap == null) {
                onProgress("Stopping: screenshot capture failed on page $page.")
                break
            }
            val blocks = ocrEngine.recognizeBlocks(bitmap)

            val headerY = findHeaderY(blocks)
            val records = RescueRecordParser.parseTableRows(blocks, selectedBanner, headerY)

            onProgress("Page $page: ${records.size} rows. Texts: ${blocks.take(6).map { it.text }}")

            if (records.isEmpty()) {
                onProgress("Stopping: page $page parsed 0 rows.")
                break
            }
            if (records == previousPageRecords) {
                onProgress("Stopping: page $page rows identical to previous page (likely last page).")
                break
            }
            allRecords.addAll(records)
            previousPageRecords = records

            val nextCoords = findNextButtonCoords(blocks, bitmap.width, bitmap.height)
            if (nextCoords == null) {
                val allTexts = blocks.map { "'${it.text}'" }.joinToString(" | ")
                onProgress("No next btn. All texts: $allTexts")
                break
            }

            val (cx, cy) = nextCoords
            val currentPageNum = extractPageNumber(blocks, bitmap.width, bitmap.height)
            onProgress("Tapping next at (${"%.0f".format(cx)}, ${"%.0f".format(cy)}). Current page-num OCR=$currentPageNum")
            gestures.tap(cx, cy)

            onProgress("Waiting for page ${page + 1} to load...")
            val loaded = waitForPageChange(currentPageNum, timeoutMs = 10_000L)
            if (!loaded) {
                onProgress("Timeout waiting for page ${page + 1}. Stopping.")
                break
            }
            page++
        }

        val deduped = RescueRecordParser.deduplicate(allRecords)
        onProgress("Done: scanned $page page(s), ${allRecords.size} raw, ${deduped.size} after dedup")
        return deduped
    }

    private fun findNextButtonCoords(blocks: List<OcrBlock>, screenWidth: Int, screenHeight: Int): Pair<Float, Float>? {
        // Option 1: user calibrated the position manually — always use this first
        if (calibX != null && calibY != null) return calibX to calibY

        // Option 2: OCR detected the ">" character directly
        val nextChars = setOf(">", "›", "»", "▶", "→", ">>", "next", "Next")
        val textBlock = blocks.filter { it.text.trim() in nextChars }.maxByOrNull { it.bounds.left }
        if (textBlock != null) return textBlock.bounds.exactCenterX() to textBlock.bounds.exactCenterY()

        // Option 3: find page number in bottom area, tap to its right
        val bottomZone = (screenHeight * 0.55f).toInt()
        val digits = Regex("""\d{1,3}""")
        val pageNumBlock = blocks
            .filter { it.bounds.top > bottomZone && digits.containsMatchIn(it.text) }
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
        // 55% threshold instead of 66% — accommodates both landscape and portrait
        // foldable layouts where the pagination row sits a bit higher.
        val bottomZone = (screenHeight * 0.55f).toInt()
        val digits = Regex("""\d{1,3}""")
        // Page indicator is sometimes grouped with surrounding chars by OCR (e.g. "< 12", "12 >", "Page 12").
        // So extract any 1-3 digit run from the block's text rather than requiring an exact match.
        return blocks
            .filter { it.bounds.top > bottomZone && digits.containsMatchIn(it.text) }
            .minByOrNull { Math.abs(it.bounds.exactCenterX() - screenWidth / 2f) }
            ?.let { digits.find(it.text)?.value?.toIntOrNull() }
    }

    private suspend fun waitForPageChange(previousPageNum: Int?, timeoutMs: Long): Boolean {
        val deadline = System.currentTimeMillis() + timeoutMs
        var attempt = 0
        var lastSeenNumbers = ""
        var lastBitmap: android.graphics.Bitmap? = null
        var lastAllTexts = ""
        while (System.currentTimeMillis() < deadline) {
            delay(600)
            attempt++
            val bitmap = screenshotManager.capture() ?: continue
            lastBitmap = bitmap
            val blocks = ocrEngine.recognizeBlocks(bitmap)
            val newPageNum = extractPageNumber(blocks, bitmap.width, bitmap.height)
            if (newPageNum != null && newPageNum != previousPageNum) {
                onProgress("Page changed: $previousPageNum -> $newPageNum (after $attempt attempt(s))")
                return true
            }
            // Diagnostic: every 3 attempts, report what numbers we see at the bottom
            if (attempt % 3 == 0) {
                val digits = Regex("""\d{1,3}""")
                val bottomZone = (bitmap.height * 0.55f).toInt()
                val bottomNums = blocks
                    .filter { it.bounds.top > bottomZone && digits.containsMatchIn(it.text) }
                    .joinToString(",") { "${it.text.trim()}@x${it.bounds.exactCenterX().toInt()}" }
                lastSeenNumbers = bottomNums
                lastAllTexts = blocks.joinToString(" | ") { "'${it.text}'@(${it.bounds.left},${it.bounds.top})" }
                onProgress("waitForPageChange: attempt=$attempt newPageNum=$newPageNum bottom-numbers=[$bottomNums] total-blocks=${blocks.size}")
            }
        }
        onProgress("waitForPageChange exhausted. Last bottom-numbers: [$lastSeenNumbers] (looking for change from $previousPageNum)")
        onProgress("All OCR blocks at timeout: $lastAllTexts")
        lastBitmap?.let { saveDebugBitmap?.invoke(it, "timeout_after_p${previousPageNum ?: "unknown"}") }
        return false
    }

    private fun findHeaderY(blocks: List<OcrBlock>): Int {
        // Header row contains "Type", "Rescue List", "Rescue Type", "Rescue Time"
        return blocks.firstOrNull { it.text == "Type" || it.text == "Rescue List" }
            ?.bounds?.bottom ?: 0
    }
}
