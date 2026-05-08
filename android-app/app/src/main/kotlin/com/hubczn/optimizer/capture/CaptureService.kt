package com.hubczn.optimizer.capture

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.content.pm.ServiceInfo
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.Build
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.hubczn.optimizer.data.local.RescueRecordDatabase
import com.hubczn.optimizer.data.local.RescueRecordEntity
import com.hubczn.optimizer.data.local.ScanConfigStore
import com.hubczn.optimizer.data.repository.CharacterRepository
import com.hubczn.optimizer.data.repository.JSONExporter
import com.hubczn.optimizer.logic.CombatantScanner
import com.hubczn.optimizer.logic.MemoryFragmentScanner
import com.hubczn.optimizer.logic.RescueRecordScanner
import com.hubczn.optimizer.model.RescueRecord
import com.hubczn.optimizer.ui.components.FloatingOverlay
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class CaptureService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var projection: MediaProjection? = null
    private var screenshotManager: ScreenshotManager? = null
    private var ocrEngine: MLKitOCREngine? = null
    private val serviceLifecycleOwner = ServiceLifecycleOwner()
    private var overlay: FloatingOverlay? = null

    private val configStore by lazy { ScanConfigStore(this) }
    private val charRepo by lazy { CharacterRepository(this) }
    private val db by lazy { RescueRecordDatabase.getInstance(this) }

    enum class ScanType { RESCUE_RECORDS, MEMORY_FRAGMENTS, COMBATANTS }

    /**
     * Apply the user's saved language override to the service's base
     * Context BEFORE any resources are accessed. Without this, the
     * floating overlay's stringResource(...) calls (and getString(...) in
     * notifications) fall back to the system default and ignore the
     * Portuguese/English toggle the user set in MainActivity.
     */
    override fun attachBaseContext(newBase: android.content.Context) {
        val lang = ScanConfigStore(newBase).languageOverride
        if (lang.isNullOrEmpty()) {
            super.attachBaseContext(newBase)
            return
        }
        val locale = java.util.Locale.forLanguageTag(lang)
        java.util.Locale.setDefault(locale)
        val config = android.content.res.Configuration(newBase.resources.configuration)
        config.setLocale(locale)
        super.attachBaseContext(newBase.createConfigurationContext(config))
    }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ocrEngine = MLKitOCREngine()
        serviceLifecycleOwner.start()

        overlay = FloatingOverlay(
            context = this,
            lifecycleOwner = serviceLifecycleOwner,
            savedStateRegistryOwner = serviceLifecycleOwner,
            configStore = configStore,
            onScanRescue = { bannerIndex, pageLimit -> startScan(ScanType.RESCUE_RECORDS, bannerIndex, pageLimit) },
            onScanFragments = { pageLimit -> startScan(ScanType.MEMORY_FRAGMENTS, pageLimit = pageLimit) },
            onScanCombatants = { pageLimit -> startScan(ScanType.COMBATANTS, pageLimit = pageLimit) },
            onClose = { stopSelf() }
        )
        overlay?.show()
    }

    @Suppress("DEPRECATION")
    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val projectionResultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, -1) ?: return START_NOT_STICKY
        val projectionData = intent.getParcelableExtra<Intent>(EXTRA_PROJECTION_DATA) ?: return START_NOT_STICKY

        val notification = buildNotification("CZN Scanner running")
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            startForeground(NOTIF_ID, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_MEDIA_PROJECTION)
        } else {
            startForeground(NOTIF_ID, notification)
        }

        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projection = projectionManager.getMediaProjection(projectionResultCode, projectionData)

        screenshotManager = ScreenshotManager(this, projection!!).also { it.start() }

        instance = this
        notifyStatus("Ready — tap overlay to scan")
        return START_NOT_STICKY
    }

    private fun startScan(scanType: ScanType, bannerIndex: Int = 0, pageLimit: Int? = null) {
        val accessibilityService = CZNAccessibilityService.instance ?: run {
            notifyStatus("Accessibility Service not enabled")
            return
        }
        val sm = screenshotManager ?: run {
            notifyStatus("ScreenshotManager not ready")
            return
        }
        val ocr = ocrEngine ?: run {
            notifyStatus("OCR engine not ready")
            return
        }

        val gestures = GestureDispatcher(accessibilityService)
        val exporter = JSONExporter(this)

        scope.launch {
            try {
                when (scanType) {
                    ScanType.RESCUE_RECORDS -> {
                        val bannerName = BANNER_NAMES[bannerIndex]
                        val store = configStore
                        val records = RescueRecordScanner(
                            sm, ocr, gestures,
                            selectedBanner = bannerName,
                            pageLimit = pageLimit,
                            calibX = store.calibRescueX,
                            calibY = store.calibRescueY,
                            onProgress = { notifyStatus(it) },
                            saveDebugBitmap = { bmp, label ->
                                runCatching {
                                    val file = java.io.File(filesDir, "$label.png")
                                    java.io.FileOutputStream(file).use { fos ->
                                        bmp.compress(android.graphics.Bitmap.CompressFormat.PNG, 90, fos)
                                    }
                                    android.util.Log.i("CZNScanner", "Saved debug bitmap: ${file.absolutePath} (${bmp.width}x${bmp.height})")
                                }.onFailure { android.util.Log.e("CZNScanner", "Failed to save debug bitmap: ${it.message}") }
                            }
                        ).scan()

                        // Upsert to DB with pull_number assignment.
                        //
                        // Dedup rule: a "pull" is uniquely identified by
                        // (bannerName, name, type, createAt, rescueType, isFeatured).
                        // The same player may legitimately have N pulls of one
                        // character at the same second (10-pull, etc.), so we keep
                        // multiple via duplicateIdx 0..N-1. Across scans, however,
                        // the same pull must NOT be added again.
                        //
                        // Algorithm: group this scan's records by the natural key,
                        // compare its size to what is already in the DB for that key,
                        // and only insert the missing surplus (if any).
                        val dao = db.rescueRecordDao()
                        val sorted = records.sortedWith(compareBy({ it.createAt }, { records.indexOf(it) }))

                        data class Key(val banner: String, val name: String, val type: String, val createAt: String, val rescueType: String, val isFeatured: Boolean)
                        val groups = sorted.groupBy { Key(it.bannerName, it.name, it.type, it.createAt, it.rescueType, it.isFeatured) }

                        val toInsert = mutableListOf<Pair<RescueRecord, Int>>() // record -> dupIdx
                        for ((key, occurrences) in groups) {
                            val existing = dao.countDuplicates(key.banner, key.name, key.type, key.createAt, key.rescueType, key.isFeatured)
                            val surplus = occurrences.size - existing
                            if (surplus <= 0) continue
                            // Insert the last `surplus` occurrences (arbitrary; they're equivalent)
                            occurrences.takeLast(surplus).forEachIndexed { i, rec ->
                                toInsert += rec to (existing + i)
                            }
                        }

                        val maxPull = dao.maxPullNumber()
                        val entities = toInsert.mapIndexed { idx, (r, dupIdx) ->
                            val info = charRepo.lookup(r.name)
                            RescueRecordEntity(
                                bannerName = r.bannerName,
                                name = r.name,
                                type = r.type,
                                createAt = r.createAt,
                                rescueType = r.rescueType,
                                isFeatured = r.isFeatured,
                                duplicateIdx = dupIdx,
                                resId = info?.resId,
                                rarity = info?.rarity,
                                pullNumber = maxPull + idx + 1
                            )
                        }
                        dao.upsertAll(entities)
                        // Renumber so pullNumber reflects chronological order
                        // even when multiple partial scans inserted records out of order.
                        dao.renumberPullNumbersByCreateAt()
                        android.util.Log.i("CZNScanner", "DB upsert: scan=${records.size} groups=${groups.size} inserted=${entities.size} skipped=${records.size - entities.size}")

                        val dbExporter = JSONExporter(this@CaptureService, dao, store.outputFolderUri)
                        val filename = dbExporter.exportRescueRecordsFromDb()
                        notifyStatus("Exported to $filename")
                    }
                    ScanType.MEMORY_FRAGMENTS -> {
                        val store = configStore
                        val fragments = MemoryFragmentScanner(
                            sm, ocr, gestures,
                            nextX = store.calibFragmentsX,
                            nextY = store.calibFragmentsY,
                            onProgress = { notifyStatus(it) },
                        ).scan()
                        val file = exporter.exportFragments(fragments)
                        notifyStatus("Exported ${fragments.size} fragments to ${file.name}")
                    }
                    ScanType.COMBATANTS -> {
                        val combatants = CombatantScanner(
                            sm, ocr, gestures,
                            onProgress = { notifyStatus(it) }
                        ).scan()
                        val file = exporter.exportCombatants(combatants)
                        notifyStatus("Exported ${combatants.size} combatants to ${file.name}")
                    }
                }
            } catch (e: Exception) {
                notifyStatus("Error: ${e.message}")
            }
            // NOTE: do NOT stop screenshotManager/projection here.
            // The capture session must stay alive across multiple scans so
            // the floating overlay can trigger another scan without forcing
            // the user to re-grant the screen capture permission.
            // Resources are released in onDestroy when the service is killed.
        }
    }

    override fun onDestroy() {
        // Cancel any in-flight scan coroutines BEFORE tearing the rest of
        // the service down. Without this, a scan that was mid-tap when the
        // user closed the overlay continues running and dispatches phantom
        // taps onto whatever app is now in the foreground.
        scope.coroutineContext[kotlinx.coroutines.Job]?.cancel()
        overlay?.dismiss()
        serviceLifecycleOwner.stop()
        screenshotManager?.stop()
        projection?.stop()
        ocrEngine?.close()
        instance = null
        super.onDestroy()
    }

    private fun notifyStatus(message: String) {
        android.util.Log.i("CZNScanner", message)
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.notify(NOTIF_ID, buildNotification(message))
        statusCallback?.invoke(message)
    }

    private fun buildNotification(text: String) = run {
        val channelId = "czn_scanner"
        val nm = getSystemService(NOTIFICATION_SERVICE) as NotificationManager
        nm.createNotificationChannel(
            NotificationChannel(channelId, "CZN Scanner", NotificationManager.IMPORTANCE_LOW)
        )
        NotificationCompat.Builder(this, channelId)
            .setContentTitle("CZN Scanner")
            .setContentText(text)
            .setSmallIcon(android.R.drawable.ic_menu_camera)
            .build()
    }

    companion object {
        const val EXTRA_RESULT_CODE = "result_code"
        const val EXTRA_PROJECTION_DATA = "projection_data"
        const val EXTRA_SCAN_TYPE = "scan_type"
        const val NOTIF_ID = 1001
        var instance: CaptureService? = null
        var statusCallback: ((String) -> Unit)? = null
        val BANNER_NAMES = listOf(
            "Seasonal Combatant Rescue Rate-Up",
            "Seasonal Partner Rescue Rate-Up",
            "Gacha General",
            "Gacha Pickup Supporter"
        )
    }
}
