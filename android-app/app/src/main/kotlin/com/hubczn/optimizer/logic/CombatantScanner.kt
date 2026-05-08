package com.hubczn.optimizer.logic

import android.graphics.Bitmap
import android.os.Environment
import com.hubczn.optimizer.capture.GestureDispatcher
import com.hubczn.optimizer.capture.MLKitOCREngine
import com.hubczn.optimizer.capture.ScreenshotManager
import com.hubczn.optimizer.model.Combatant
import com.hubczn.optimizer.model.MemoryFragment
import com.hubczn.optimizer.model.OcrBlock
import kotlinx.coroutines.delay
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Walks the entire combatant roster from the "Combatant List" grid view
 * (the larger pop-out reached from the in-game grid icon at the bottom of
 * the side strip), capturing Stats values and the 6 equipped Memory
 * Fragments per combatant. Output is a list of fully populated Combatant
 * objects with embedded fragment lists.
 *
 * Why the grid instead of the thin left strip:
 *  - Each card has a NAME label below the portrait — OCR'able and stable.
 *  - The grid is regular (6 columns) so positioning is predictable.
 *  - End-of-roster is detected when a swipe reveals no new names.
 *  - No calibration drift / pitch arithmetic needed.
 *
 * Preconditions on entry:
 *  - The "Combatant List" grid is open in the game (or any screen reachable
 *    by 1-3 system back presses; the scanner self-navigates to the grid).
 *  - The floating overlay is visible.
 *
 * Termination:
 *  - Two consecutive swipes reveal NO new combatant names.
 *  - 5 consecutive iterations failed to read either the grid or a stats panel.
 *  - Iteration count >= MAX_ITERATIONS (hard cap).
 */
class CombatantScanner(
    private val screenshotManager: ScreenshotManager,
    private val ocrEngine: MLKitOCREngine,
    private val gestures: GestureDispatcher,
    onProgress: (String) -> Unit = {}
) {

    /**
     * Persistent debug log written next to the JSON exports. The
     * overlay log shown to the user is short-lived; pulling this file
     * later via ADB lets us see exactly what ML Kit returned for each
     * combatant scan without asking the user to copy/paste.
     */
    private val debugLog: File by lazy {
        val dir = File(
            Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
            "CZN-Scanner"
        ).apply { mkdirs() }
        val ts = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US).format(Date())
        File(dir, "combatants_scan_debug_$ts.log")
    }

    private val externalProgress: (String) -> Unit = onProgress

    /**
     * Forwards each message to the caller-supplied progress callback
     * AND appends it (with a timestamp) to [debugLog].
     */
    private val onProgress: (String) -> Unit = { msg ->
        externalProgress(msg)
        try {
            debugLog.appendText(
                "${SimpleDateFormat("HH:mm:ss.SSS", Locale.US).format(Date())} $msg\n"
            )
        } catch (_: Exception) {
            // Logging failures must never break the scan.
        }
    }

    companion object {
        private const val MAX_ITERATIONS = 200
        private const val ANIM_PANEL_MS = 600L  // tab / page change
        private const val ANIM_SLOT_MS = 400L   // slot select
        private const val MAX_BACK_PRESSES_TO_GRID = 4

        /** UI labels visible on the Combatant List grid that must NOT be parsed as combatant names. */
        private val NON_NAME_LABELS = setOf(
            "Combatant List", "ALL", "LV", "Level", "Preset", "Synchronization",
            "Stats", "Cards", "Partners", "Save Data", "Potential",
            "Memory Fragments", "Ego Manifestation", "Details", "View Details",
            "Set Effect", "Equip Recommended", "Manage", "Synchronization Status",
            "Combatant Rescue"
        )

        /**
         * Combatant name candidate: capital letter, lowercase letter, then
         * 1-14 more LOWERCASE letters/'/-, optionally followed by a space
         * and a second capitalised word (e.g. "Mei Lin").
         */
        private val NAME_REGEX = Regex("""^[A-Z][a-z][a-z'-]{1,14}(\s[A-Z][a-z][a-z'-]{0,14})?$""")

        /**
         * Canonical roster of combatant names. ML Kit returns spurious
         * 3-letter blocks ("Eay", "Dur") that pass the regex but are
         * not real combatants — they navigate the scanner to whatever
         * card happens to sit under the OCR coordinates and pollute
         * the export. Restricting candidate names to the canonical
         * list (with Levenshtein distance ≤ 1 to absorb single-char
         * OCR typos) eliminates these.
         *
         * If the game adds new combatants, append them here.
         */
        private val CANONICAL_NAMES = setOf(
            "Nia", "Luke", "Selena", "Khalipe", "Tressa", "Magna",
            "Amir", "Rin", "Lucas", "Orlea", "Mei Lin", "Maribell",
            "Veronica", "Mika", "Beryl", "Renoa", "Hugo", "Cassius",
            "Owen", "Narja", "Rei", "Yuki", "Chizuru", "Diana", "Haru",
            "Nine", "Sereniel", "Tiphera", "Heidemarie", "Rita"
        )

        /**
         * Any of these blocks proves we are on the Combatant List grid. Using
         * multiple anchors avoids false negatives when ML Kit splits the
         * "Combatant List" title into two blocks ("Combatant" + "List") or
         * mis-reads it slightly.
         */
        private val GRID_MARKERS = setOf(
            "Combatant List", "Synchronization", "Preset", "Synchronization Status"
        )
    }

    /**
     * Per-fragment scan record. `badgeFilled` is true when the slot's
     * "+N" upgrade badge was OCR-detected next to the icon BEFORE the
     * tap. It is used by the cross-combatant dedup pass to break ties
     * when the same fragment shows up under two different combatants:
     * the game's "Equip Recommended" preview (shown when an empty slot
     * is tapped) borrows fragment data from other characters' real
     * loadouts. Real fragments can only be equipped on one combatant at
     * a time, so any duplicate signature is by definition a phantom.
     */
    private data class FragRecord(
        val fragment: MemoryFragment,
        val badgeFilled: Boolean
    )

    /** Mutable accumulator for one combatant during scan. */
    private data class PendingCombatant(
        val stats: Combatant,
        val frags: MutableList<FragRecord>
    )

    suspend fun scan(): List<Combatant> {
        // Per-combatant accumulation. Combatants are committed to the
        // returned list only after the cross-combatant dedup pass, so
        // we can drop phantom recordings without restructuring already-
        // returned data.
        val pending = mutableListOf<PendingCombatant>()
        val seenNames = mutableSetOf<String>()
        var consecutiveEmptySwipes = 0
        var consecutiveFails = 0

        // Self-navigate to the Combatant List grid in case the user started
        // on a different screen.
        if (!ensureOnCombatantList()) {
            onProgress("Could not reach 'Combatant List' grid. Please open it manually before starting.")
            return finalize(pending)
        }

        for (iter in 0 until MAX_ITERATIONS) {
            // 1. OCR the grid.
            val gridBmp = screenshotManager.capture() ?: break
            val gridBlocks = ocrEngine.recognizeBlocks(gridBmp)

            // 2. Confirm we're still on the grid; if not, recover.
            if (!isOnGrid(gridBlocks)) {
                onProgress("Lost grid view; pressing back to recover.")
                if (!ensureOnCombatantList()) {
                    consecutiveFails++
                    if (consecutiveFails >= 5) {
                        onProgress("Stopping: lost grid 5 times in a row.")
                        return finalize(pending)
                    }
                    continue
                }
                continue
            }

            // 3. Find name candidates not yet processed.
            //
            // Sort: bucket blocks into "rows" by Y-proximity (within ~40px),
            // then sort each row left-to-right. Naive (top, left) sort fails
            // because OCR often reports slightly different `top` values for
            // labels in the same visual row (a 4-5px jitter), which would
            // break reading order.
            // Diagnostic: dump every "near-name" block (starts with a
            // capital letter, length 3-20, not a known UI label) and
             // why it was accepted or rejected. When a roster combatant is
            // skipped (e.g. Tiphera vanishes between Rita and the next
            // capture), this log shows whether ML Kit OCR'd her at all
            // and in what form, so the regex / dedup can be tightened
            // without guessing.
            val nearNameBlocks = gridBlocks.filter { b ->
                val t = b.text.trim()
                t.length in 3..20 && t.firstOrNull()?.isUpperCase() == true && t !in NON_NAME_LABELS
            }
            if (nearNameBlocks.isNotEmpty()) {
                val report = nearNameBlocks.joinToString(" | ") { b ->
                    val t = b.text.trim()
                    val flags = buildString {
                        append(if (NAME_REGEX.matches(t)) "ok" else "rgx")
                        if (t in seenNames) append(",seen")
                    }
                    "'$t'[$flags]@(${b.bounds.exactCenterX().toInt()},${b.bounds.exactCenterY().toInt()})"
                }
                onProgress("Grid near-name blocks: $report")
            }

            // Filter against `seenNames` using the CANONICAL name, not the
            // raw OCR text. Without this, a fuzzy block like "HUTiphera"
            // (canonicalises to "Tiphera") stays in the candidate list
            // forever — the inner processing loop skips it because
            // "Tiphera" is already seen, but the outer loop sees a
            // non-empty candidate list and never swipes for new names.
            val rawCandidates = gridBlocks
                .filter { isNameCandidate(it.text) }
                .filter { (canonicalize(it.text.trim()) ?: it.text.trim()) !in seenNames }
                .sortedBy { it.bounds.top }

            val rowBuckets = mutableListOf<MutableList<OcrBlock>>()
            for (b in rawCandidates) {
                val lastRow = rowBuckets.lastOrNull()
                if (lastRow != null && b.bounds.top - lastRow.first().bounds.top < 40) {
                    lastRow.add(b)
                } else {
                    rowBuckets.add(mutableListOf(b))
                }
            }
            val candidates = rowBuckets.flatMap { row -> row.sortedBy { it.bounds.left } }

            if (candidates.isEmpty()) {
                // 4. No new names visible: swipe to reveal more.
                consecutiveEmptySwipes++
                // Bumped from 2 to 3: with the slow-drag scroll, a single
                // swipe sometimes covers <1 grid row of new content (UI
                // damping returns less than the gesture distance). One
                // dud swipe is normal at row boundaries; two-in-a-row is
                // the genuine end-of-list signal.
                if (consecutiveEmptySwipes >= 3) {
                    onProgress("Done: no new combatants after 3 swipes (total ${pending.size}).")
                    return finalize(pending)
                }
                onProgress("No new names visible — swiping up.")
                // SLOW, MEDIUM-DISTANCE swipe: 0.75 → 0.35 = 40% of screen
                // height dragged over 800ms. Slow enough that the scroll
                // view does not fling (which would skip 2+ rows via
                // inertia), but far enough to reliably reveal at least
                // one fresh row even when the UI dampens scroll relative
                // to the gesture. `seenNames` deduplicates any visible
                // overlap with the previous frame.
                gestures.swipeUp(
                    x = gridBmp.width / 2f,
                    fromY = gridBmp.height * 0.75f,
                    toY = gridBmp.height * 0.35f,
                    durationMs = 800
                )
                delay(ANIM_PANEL_MS)
                continue
            }

            consecutiveEmptySwipes = 0

            // 5. Process each new candidate.
            for (cand in candidates) {
                // Always normalise to the canonical roster name so that
                // a fuzzy OCR ("Tip", "Khaliper", "Riha") and the clean
                // OCR ("Tiphera", "Khalipe", "Rita") share a seenNames
                // entry — otherwise the same combatant gets visited
                // twice when both forms appear across iterations.
                val rawName = cand.text.trim()
                val expectedName = canonicalize(rawName) ?: rawName
                if (expectedName in seenNames) continue // changed during loop

                // Read the ego level off the grid card BEFORE tapping
                // — once we leave the grid, that number is gone until
                // we come back. Default 0 if unreadable.
                val ego = parseEgoFromGrid(gridBlocks, cand, gridBmp)
                onProgress("Tap card '$rawName' (-> '$expectedName', E$ego) @(${cand.bounds.exactCenterX().toInt()}, ${cand.bounds.exactCenterY().toInt()})")
                gestures.tap(cand.bounds.exactCenterX(), cand.bounds.exactCenterY())
                delay(ANIM_PANEL_MS)

                val stats = readStats()
                if (stats == null) {
                    onProgress("Failed to read stats for '$expectedName'. Going back to grid.")
                    consecutiveFails++
                    backToGrid()
                    if (consecutiveFails >= 5) {
                        onProgress("Stopping: 5 consecutive stat-read failures.")
                        return finalize(pending)
                    }
                    continue
                }

                consecutiveFails = 0
                // Trust the GRID name over the Stats-panel OCR. The grid
                // labels render in a clean font and are very reliable; the
                // Stats panel renders the name in a stylised game font that
                // ML Kit often mis-reads (e.g. "Haru" -> "AAMMA").
                val finalName = expectedName
                if (finalName in seenNames) {
                    backToGrid()
                    continue
                }

                val fragRecords = readEquippedFragments(finalName)
                pending.add(PendingCombatant(stats.copy(name = finalName, ego = ego), fragRecords.toMutableList()))
                seenNames.add(finalName)
                onProgress("Captured ${pending.size}: $finalName (+${fragRecords.size} fragments)")

                // Return to grid: pressBack twice (once from MF page, once from detail).
                backToGrid()
            }
            // After processing all visible new names, the next iteration will
            // OCR again and either find more (if a swipe wasn't needed) or
            // hit the empty-candidates path which swipes.
        }

        onProgress("Stopping: hit MAX_ITERATIONS=$MAX_ITERATIONS.")
        return finalize(pending)
    }

    /**
     * Cross-combatant dedup pass. The game's "Equip Recommended" preview
     * (shown when an empty slot is tapped) borrows fragment data from
     * OTHER characters' real loadouts. Real fragments are character-
     * unique, so any (slot_num + setName + level + statList) signature
     * that appears under more than one combatant must contain at least
     * one phantom. Tie-break: keep the record whose "+N" badge was
     * detected before the tap (`badgeFilled`); if multiple, keep the
     * first occurrence; if none, keep the first as a best-effort
     * fallback.
     *
     * Combatants are emitted in scan order with their surviving
     * fragments. A combatant whose fragments were ALL phantom-removed
     * is still emitted (with empty equippedFragments) so the export
     * preserves the roster order.
     */
    private fun finalize(pending: List<PendingCombatant>): List<Combatant> {
        data class Loc(val cIdx: Int, val sIdx: Int, val badgeFilled: Boolean)
        val sigToLocs = mutableMapOf<List<String>, MutableList<Loc>>()
        for ((cIdx, pc) in pending.withIndex()) {
            for ((sIdx, rec) in pc.frags.withIndex()) {
                val sig = fragmentSignature(rec.fragment)
                sigToLocs.getOrPut(sig) { mutableListOf() }.add(Loc(cIdx, sIdx, rec.badgeFilled))
            }
        }
        val toDrop = mutableSetOf<Pair<Int, Int>>()  // (cIdx, sIdx)
        for ((sig, locs) in sigToLocs) {
            if (locs.size <= 1) continue
            val keeper = locs.firstOrNull { it.badgeFilled } ?: locs.first()
            for (loc in locs) {
                if (loc !== keeper) {
                    toDrop.add(loc.cIdx to loc.sIdx)
                    val frag = pending[loc.cIdx].frags[loc.sIdx].fragment
                    onProgress("Dedup: drop slot ${frag.slotNum} ${frag.setName} from '${pending[loc.cIdx].stats.name}' — duplicate of '${pending[keeper.cIdx].stats.name}' (${locs.size} occurrences total).")
                }
            }
        }
        return pending.mapIndexed { cIdx, pc ->
            val survivors = pc.frags.withIndex()
                .filter { (sIdx, _) -> (cIdx to sIdx) !in toDrop }
                .map { it.value.fragment }
            pc.stats.copy(equippedFragments = survivors)
        }
    }

    private fun fragmentSignature(f: MemoryFragment): List<String> = buildList {
        add(f.slotNum.toString())
        add(f.setName)
        add(f.level.toString())
        add(f.rarity)
        for (s in f.statList) {
            add("${s.stat}|${s.type}|${s.value}")
        }
    }

    /**
     * Press back up to [MAX_BACK_PRESSES_TO_GRID] times, returning true once
     * the "Combatant List" title is OCR'd. If the user happens to already be
     * on the grid this is a no-op.
     */
    private suspend fun ensureOnCombatantList(): Boolean {
        repeat(MAX_BACK_PRESSES_TO_GRID) { attempt ->
            val bmp = screenshotManager.capture() ?: return false
            val blocks = ocrEngine.recognizeBlocks(bmp)
            if (isOnGrid(blocks)) return true
            onProgress("Navigating to grid (back press ${attempt + 1}).")
            gestures.pressBack()
            delay(ANIM_PANEL_MS)
        }
        // Final check after the last back press.
        val bmp = screenshotManager.capture() ?: return false
        val blocks = ocrEngine.recognizeBlocks(bmp)
        return isOnGrid(blocks)
    }

    /**
     * Returns to the Combatant List grid. From Memory Fragments → 2 back
     * presses; from Stats → 1; if already on grid → 0. Critical: we MUST
     * verify our current screen before pressing back, otherwise a stray
     * call (e.g. after a card tap that failed to navigate) presses back
     * from the grid itself and exits the entire combatant menu.
     */
    private suspend fun backToGrid() {
        // Check current screen first. If we're already on the grid, do nothing.
        val bmp0 = screenshotManager.capture() ?: return
        val blocks0 = ocrEngine.recognizeBlocks(bmp0)
        if (isOnGrid(blocks0)) return

        // First back: leaves Memory Fragments → combatant detail.
        gestures.pressBack()
        delay(ANIM_PANEL_MS)
        val bmp1 = screenshotManager.capture() ?: return
        val blocks1 = ocrEngine.recognizeBlocks(bmp1)
        if (isOnGrid(blocks1)) return

        // Second back: leaves combatant detail → Combatant List grid.
        gestures.pressBack()
        delay(ANIM_PANEL_MS)
    }

    private fun isOnGrid(blocks: List<OcrBlock>): Boolean =
        blocks.any { it.text.trim() in GRID_MARKERS }

    /**
     * Reads the Ego Manifestation level from the grid card above
     * [nameBlock]. Two-pass approach:
     *   1. CHEAP: scan the existing full-grid OCR blocks for a 0..6
     *      digit in the badge's empirical window.
     *   2. ZOOM: if step 1 finds nothing, crop the badge area out of
     *      [gridBmp], upscale 3× (bilinear), and re-OCR just that
     *      ROI. ML Kit struggles with tiny in-app numerals; tripling
     *      the pixel size recovers most of them.
     *
     * Returns 0 when both passes fail (= ego unknown / OCR couldn't
     * read it).
     *
     * Empirical box (from earlier diagnostic dumps): badge centre is
     * X ≈ nameCenterX - 175 (±20) and Y ≈ nameTop - 270 (±15). The
     * box is kept tight so it doesn't bleed into the neighbour card
     * on the left or grab the lower potential-level badge.
     */
    /**
     * Convert an OCR'd badge string to the ego level it represents,
     * or null if the text is unrecognisable. The badge always renders
     * as a zero-padded 2-digit value in [0..6] ("00", "01", "06",
     * etc.), but ML Kit happily mis-reads
     *   "01" → "O1" / "OI" / "LO"
     *   "06" → "Ob" / "06)" / "08"
     *   "00" → "OO" / "DO"
     * So we accept letter substitutes for digits, then take the
     * largest non-zero in the string (since the first digit is always
     * 0). If all chars normalise to 0 the badge is E0.
     */
    private fun parseEgoOcr(text: String): Int? {
        val t = text.trim()
        if (t.isEmpty() || t.length > 4) return null
        val digits = t.mapNotNull { c ->
            when (c.lowercaseChar()) {
                in '0'..'9' -> c.digitToIntOrNull()
                'o', 'q', 'd' -> 0
                'i', 'l', '|' -> 1
                's' -> 5
                'b' -> 6
                'g' -> 6
                else -> null
            }
        }
        if (digits.isEmpty()) return null
        // Reject if any digit is > 6 — that's neither a letter sub nor
        // an ego value (ego is 0..6), so the whole token is junk.
        if (digits.any { it !in 0..9 } || digits.any { it > 6 }) return null
        val nonZero = digits.firstOrNull { it != 0 }
        return nonZero ?: 0
    }

    private suspend fun parseEgoFromGrid(
        blocks: List<OcrBlock>,
        nameBlock: OcrBlock,
        gridBmp: Bitmap,
    ): Int {
        val nameCenterX = nameBlock.bounds.exactCenterX()
        val nameTop = nameBlock.bounds.top
        val xMin = nameCenterX - 230f
        val xMax = nameCenterX - 120f
        val yMin = nameTop - 320
        val yMax = nameTop - 230

        // Pass 1: cheap.
        val cheapPick = blocks.filter { b ->
            val cx = b.bounds.exactCenterX()
            val cy = b.bounds.exactCenterY().toInt()
            cx >= xMin && cx <= xMax && cy in yMin..yMax
        }.mapNotNull { b ->
            val v = parseEgoOcr(b.text)
            if (v != null) b to v else null
        }.minByOrNull { (b, _) -> b.bounds.top }

        if (cheapPick != null) {
            val (b, v) = cheapPick
            onProgress("  egoSearch '${nameBlock.text.trim()}': cheap '${b.text.trim()}' → E$v")
            return v
        }

        // Pass 2: zoom + re-OCR. The crop in pass 1 was the WIDE
        // search window so we can see whether ML Kit picks the badge
        // up at native resolution. For the zoom pass we use a TIGHT
        // crop centred exactly on the badge (~60×60 px) so the OCR
        // doesn't have to compete with adjacent character art — when
        // background pixels dominate the upscaled crop, ML Kit
        // confuses "01" with the letters "LO" / "OI".
        val baseCx = (nameCenterX - 175f).toInt()
        val baseCy = nameTop - 270
        val scale = 5
        val half = 45  // 90×90 ROI before upscale

        val saveCrop: (Bitmap, String) -> Unit = { bmp, suffix ->
            try {
                val dir = File(
                    Environment.getExternalStoragePublicDirectory(Environment.DIRECTORY_DOWNLOADS),
                    "CZN-Scanner"
                ).apply { mkdirs() }
                val name = "ego_${nameBlock.text.trim().replace(' ', '_')}_$suffix.png"
                File(dir, name).outputStream().use { os ->
                    bmp.compress(Bitmap.CompressFormat.PNG, 100, os)
                }
            } catch (_: Exception) {}
        }

        // Try several crop offsets — the empirical (-175, -270) anchor
        // drifts ±15-25 px between cards and between scan runs, and a
        // tight 90×90 misses the badge when it does. The first attempt
        // that yields a parseable digit wins.
        val offsets = listOf(
            Triple(0, 0, "centre"),
            Triple(15, 15, "DR"),  // down-right (Veronica was here)
            Triple(-15, 0, "L"),
            Triple(0, -20, "U"),
            Triple(15, -15, "UR"),
        )

        for ((dx, dy, tag) in offsets) {
            val cx = baseCx + dx
            val cy = baseCy + dy
            val left = (cx - half).coerceIn(0, gridBmp.width - 1)
            val top = (cy - half).coerceIn(0, gridBmp.height - 1)
            val right = (cx + half).coerceIn(left + 1, gridBmp.width)
            val bottom = (cy + half).coerceIn(top + 1, gridBmp.height)
            val w = right - left
            val h = bottom - top
            if (w < 10 || h < 10) continue

            val crop = Bitmap.createBitmap(gridBmp, left, top, w, h)
            val zoomed = Bitmap.createScaledBitmap(crop, w * scale, h * scale, true)
            try {
                val zoomBlocks = ocrEngine.recognizeBlocks(zoomed)
                val pick = zoomBlocks.mapNotNull { b ->
                    val v = parseEgoOcr(b.text)
                    if (v != null) b to v else null
                }.minByOrNull { (b, _) -> b.bounds.top }
                if (pick != null) {
                    val (b, v) = pick
                    onProgress("  egoSearch '${nameBlock.text.trim()}': zoom@$tag '${b.text.trim()}' → E$v")
                    return v
                }
                if (tag == "centre") {
                    // Save the centre crop only — that's the diagnostic
                    // baseline. Other offsets are just retries.
                    saveCrop(crop, "miss")
                }
            } finally {
                crop.recycle()
                zoomed.recycle()
            }
        }

        onProgress("  egoSearch '${nameBlock.text.trim()}': zoom exhausted all offsets, E0")
        return 0
    }

    /**
     * Returns the canonical name that best matches [text], or null if
     * none does. Accepts an exact match, a substring relationship in
     * either direction (handles "Tip" → "Tiphera" and "Khaliper" →
     * "Khalipe"), or Levenshtein distance ≤ 1 (single-char OCR typos
     * like "Riha" → "Rita"). Rejects obvious concatenations (where
     * two distinct canonical names appear inside the candidate, e.g.
     * "RitabU Tiphera"), since processing such a block under either
     * name silently loses the other.
     */
    private fun canonicalize(text: String): String? {
        val t = text.trim()
        if (t in CANONICAL_NAMES) return t
        // Reject concatenations: if 2+ DIFFERENT canonical names are
        // contained as words inside the candidate, the OCR has merged
        // adjacent cards and neither name is recoverable here.
        val containedCount = CANONICAL_NAMES.count { c -> t.contains(c, ignoreCase = false) }
        if (containedCount >= 2) return null
        // Substring (either direction): "Tip" ⊂ "Tiphera", "Khaliper" ⊃ "Khalipe".
        val sub = CANONICAL_NAMES.firstOrNull { c ->
            (t.length >= 3 && c.contains(t, ignoreCase = false)) ||
                (c.length >= 3 && t.contains(c, ignoreCase = false))
        }
        if (sub != null) return sub
        // Levenshtein ≤ 1: tolerate a single OCR'd character substitution.
        return CANONICAL_NAMES.firstOrNull { levenshtein(t, it) <= 1 }
    }

    private fun levenshtein(a: String, b: String): Int {
        if (a == b) return 0
        if (a.isEmpty()) return b.length
        if (b.isEmpty()) return a.length
        val prev = IntArray(b.length + 1) { it }
        val curr = IntArray(b.length + 1)
        for (i in 1..a.length) {
            curr[0] = i
            for (j in 1..b.length) {
                val cost = if (a[i - 1] == b[j - 1]) 0 else 1
                curr[j] = minOf(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost)
            }
            for (j in 0..b.length) prev[j] = curr[j]
        }
        return prev[b.length]
    }

    private fun isNameCandidate(text: String): Boolean {
        val trimmed = text.trim()
        if (trimmed in NON_NAME_LABELS) return false
        // Skip the name regex: ML Kit sometimes prefixes a card's
        // OCR'd name with stray glyphs that lock it out of the strict
        // [A-Z][a-z]... pattern (e.g. "HUTiphera" — Tiphera + "HU"
        // from an adjacent UI element, second char is uppercase). The
        // canonical-list match below is strict on its own and admits
        // those cases via substring/Levenshtein normalisation.
        return canonicalize(trimmed) != null
    }

    /**
     * Ensures the Stats sub-tab is active, then captures and parses the
     * Stats panel. After tapping a card from the grid the detail screen
     * usually defaults to Stats, but be defensive.
     */
    private suspend fun readStats(): Combatant? {
        val sidebarBmp = screenshotManager.capture() ?: return null
        val sidebarBlocks = ocrEngine.recognizeBlocks(sidebarBmp)
        val statsTab = CombatantSidebar.findTab(sidebarBlocks, "Stats")
        onProgress("readStats: Stats tab ${if (statsTab != null) "found@(${statsTab.first.toInt()},${statsTab.second.toInt()})" else "MISSING"}; total OCR blocks=${sidebarBlocks.size}")
        val freshBlocks: List<OcrBlock> = if (statsTab != null) {
            gestures.tap(statsTab.first, statsTab.second)
            delay(ANIM_PANEL_MS)
            val bmp = screenshotManager.capture() ?: return null
            ocrEngine.recognizeBlocks(bmp)
        } else {
            sidebarBlocks
        }
        val parsed = CombatantParser.parseStats(freshBlocks)
        if (parsed == null) {
            // Diagnostic: dump full block list (may be split across multiple
            // log lines if too long) so we can see what screen we're on.
            val all = freshBlocks.joinToString(" | ") { "'${it.text}'@(${it.bounds.left},${it.bounds.top})" }
            onProgress("parseStats null. All ${freshBlocks.size} blocks: $all")
        }
        return parsed
    }

    /**
     * Navigates Stats -> Memory Fragments, taps each available slot, OCRs
     * the right panel, then presses back so the caller can press back again
     * to return to the grid. Returns a [FragRecord] per parsed fragment;
     * the cross-combatant dedup pass in [finalize] uses [FragRecord.badgeFilled]
     * to break ties when the same fragment shows up under two combatants
     * (the game's "Equip Recommended" preview borrows real fragment data
     * from other characters when an empty slot is tapped).
     */
    private suspend fun readEquippedFragments(charName: String): List<FragRecord> {
        val tabsBmp = screenshotManager.capture() ?: return emptyList()
        val tabsBlocks = ocrEngine.recognizeBlocks(tabsBmp)
        val mfTab = CombatantSidebar.findTab(tabsBlocks, "Memory Fragments") ?: run {
            onProgress("Could not find 'Memory Fragments' tab for $charName.")
            return emptyList()
        }
        gestures.tap(mfTab.first, mfTab.second)
        delay(ANIM_PANEL_MS)

        val pageBmp = screenshotManager.capture() ?: return emptyList()
        val pageBlocks = ocrEngine.recognizeBlocks(pageBmp)
        val slotTargets = CombatantSidebar.findSlotTapTargets(pageBlocks)
        // Diagnostic: dump per-slot tap target + fill state and every
        // "+N"-looking block ML Kit returned. When a filled slot is
        // wrongly marked empty (and therefore skipped), this log lets us
        // see whether the badge was OCR'd at all and at what coordinates,
        // so the detection window can be tuned without guessing.
        val plusBlocks = pageBlocks.filter { Regex("""^\+\d+""").containsMatchIn(it.text.trim()) }
            .joinToString(" | ") {
                "'${it.text.trim()}'@(${it.bounds.exactCenterX().toInt()},${it.bounds.exactCenterY().toInt()})"
            }
        val slotSummary = (1..6).joinToString(", ") { n ->
            val t = slotTargets[n]
            if (t == null) "$n=missing" else {
                val tag = when {
                    t.badgeDetected -> "B"   // badge OCR'd (high confidence)
                    t.filled        -> "?"   // default-fill (no signal)
                    else            -> "E"   // big-numeral empty
                }
                "$n=$tag@(${t.x.toInt()},${t.y.toInt()})"
            }
        }
        // Roman-numeral block dimensions: empty slots render the
        // numeral large and centered (height ~80-100px); filled slots
        // place the numeral as a small badge at the top of the icon
        // (~30-40px). Dumping every numeral block's height lets us
        // calibrate the EMPTY_NUMERAL_MIN_HEIGHT threshold against real
        // device output instead of guessing.
        val numeralBlocks = pageBlocks.filter { b ->
            FragmentParser.parseSlot(b.text) in 1..6
        }.joinToString(" | ") { b ->
            val s = FragmentParser.parseSlot(b.text)
            "'${b.text.trim()}'(slot=$s,h=${b.bounds.height()},w=${b.bounds.width()})@(${b.bounds.exactCenterX().toInt()},${b.bounds.exactCenterY().toInt()})"
        }
        onProgress("MF page slots: $slotSummary | +N blocks: [$plusBlocks] | numerals: [$numeralBlocks]")
        if (slotTargets.isEmpty()) {
            onProgress("No slot icons found on Memory Fragments page for $charName.")
            return emptyList()
        }

        // SHORT-CIRCUIT: when no "+N" upgrade badge is detected on ANY of
        // the six slots, the combatant has nothing equipped. We MUST NOT
        // tap any slot in this case: tapping an empty slot opens a
        // PREVIEW / RECOMMENDATION panel that shows real-looking
        // fragment data (set name, rarity, level, stats) which
        // [parseFragmentPanel] cheerfully parses — and signature
        // comparison can't catch it because each slot's preview is a
        // DIFFERENT recommended fragment. Skip the scan entirely.
        //
        // Risk: every badge fails OCR for a partially-equipped combatant
        // → we wrongly mark them as unequipped. Mitigated by the badge
        // window being intentionally generous (X=150, Y=-60..+200) and
        // by the fact that even ONE detected badge is enough to enter
        // the per-slot loop, where signature comparison filters phantoms.
        val anyBadgeDetected = slotTargets.values.any { it.badgeDetected }
        if (!anyBadgeDetected) {
            onProgress("No '+N' badges on any of 6 slots for $charName — treating as unequipped, skipping fragment scan.")
            return emptyList()
        }

        // Skip slots that are confidently empty (no "+N" badge AND a
        // big centered Roman numeral inside the circle — see
        // [CombatantSidebar.findSlotTapTargets] for the multi-signal
        // logic). Tapping a true-empty slot opens a "Recommended
        // fragment" preview that borrows REAL data from another
        // character's loadout, which would otherwise propagate as a
        // phantom into this combatant's record.
        //
        // Slots that are uncertain (badge fails OCR but no big numeral
        // either) ARE tapped; the cross-combatant dedup pass at the end
        // of [scan] reconciles any phantoms that slip through.
        val collected = mutableListOf<FragRecord>()
        // Within-combatant signature: include the FULL parsed content
        // (rarity, level, setName, complete stat list) so consecutive
        // slots that happen to share a (rarity, level, setName) tuple
        // — Heidemarie carries Prelude to a Hero +5 in slots 2,3,5,6,
        // each with a different main stat — are kept apart. The narrow
        // (rarity, level, setName) signature was incorrectly dropping
        // those as "stale panel".
        var lastSignature: List<String>? = null
        for (slot in 1..6) {
            val target = slotTargets[slot] ?: continue
            if (!target.filled) {
                onProgress("  slot $slot: empty (no badge + big numeral); skipping")
                continue
            }
            gestures.tap(target.x, target.y)
            delay(ANIM_SLOT_MS)
            val panelBmp = screenshotManager.capture() ?: continue
            val panelBlocks = ocrEngine.recognizeBlocks(panelBmp)
            val rightPanel = panelBlocks.filter { it.bounds.left > panelBmp.width * 0.70 }
            val frag = CombatantParser.parseFragmentPanel(rightPanel, slot, charName)
            if (frag == null) {
                val sample = rightPanel.take(8).joinToString(" | ") { "'${it.text}'" }
                onProgress("  slot $slot: parseFragmentPanel returned null. rightPanel[${rightPanel.size}]=$sample")
                continue
            }
            // Diagnostic: when a Legendary +5 fragment ends up with
            // fewer than 5 stat entries (1 main + 4 substats), dump
            // every right-panel block + the parsed stats so we can see
            // which row was lost. Targeted at the slot-5 substat-loss
            // bug; cheap log noise for happy-path captures.
            if (frag.statList.size < 5 && frag.rarityNum >= 5) {
                val all = rightPanel.joinToString(" | ") { b ->
                    "'${b.text}'@(${b.bounds.left},${b.bounds.top},${b.bounds.right},${b.bounds.bottom})"
                }
                val parsed = frag.statList.joinToString(", ") { s -> "${s.stat}=${s.value}${if (s.type == "percent") "%" else ""}" }
                onProgress("  slot $slot: SHORT statList (${frag.statList.size}/5). parsed=[$parsed]. rightPanel=[$all]")
            }
            val signature = buildList {
                add(frag.rarity)
                add(frag.level.toString())
                add(frag.setName)
                for (s in frag.statList) add("${s.stat}|${s.type}|${s.value}")
            }
            if (signature == lastSignature) {
                onProgress("  slot $slot: panel unchanged from prev slot — stale, dropping")
                continue
            }
            lastSignature = signature
            collected.add(FragRecord(frag, badgeFilled = target.badgeDetected))
            onProgress("  slot $slot: ${frag.setName} ${frag.rarity} +${frag.level} (badge=${if (target.badgeDetected) "DETECTED" else "default-fill"})")
        }
        return collected
    }
}
