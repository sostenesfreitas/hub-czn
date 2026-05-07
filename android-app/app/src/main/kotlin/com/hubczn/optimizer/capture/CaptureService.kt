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

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        ocrEngine = MLKitOCREngine()
        serviceLifecycleOwner.start()

        overlay = FloatingOverlay(
            context = this,
            lifecycleOwner = serviceLifecycleOwner,
            savedStateRegistryOwner = serviceLifecycleOwner,
            onScanRescue = { startScan(ScanType.RESCUE_RECORDS) },
            onScanFragments = { startScan(ScanType.MEMORY_FRAGMENTS) },
            onScanCombatants = { startScan(ScanType.COMBATANTS) }
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
                            onProgress = { notifyStatus(it) }
                        ).scan()

                        // Upsert to DB with pull_number assignment
                        val dao = db.rescueRecordDao()
                        val maxPull = dao.maxPullNumber()
                        val sorted = records.sortedWith(compareBy({ it.createAt }, { records.indexOf(it) }))
                        val entities = sorted.mapIndexed { idx, r ->
                            val info = charRepo.lookup(r.name)
                            val dupIdx = dao.countDuplicates(
                                r.bannerName, r.name, r.type, r.createAt, r.rescueType, r.isFeatured
                            )
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

                        val dbExporter = JSONExporter(this@CaptureService, dao, store.outputFolderUri)
                        val filename = dbExporter.exportRescueRecordsFromDb()
                        notifyStatus("Exported to $filename")
                    }
                    ScanType.MEMORY_FRAGMENTS -> {
                        val fragments = MemoryFragmentScanner(sm, ocr, gestures) {
                            notifyStatus(it)
                        }.scan()
                        val file = exporter.exportFragments(fragments)
                        notifyStatus("Exported ${fragments.size} fragments to ${file.name}")
                    }
                    ScanType.COMBATANTS -> {
                        val combatants = CombatantScanner(sm, ocr, gestures) {
                            notifyStatus(it)
                        }.scan()
                        val file = exporter.exportCombatants(combatants)
                        notifyStatus("Exported ${combatants.size} combatants to ${file.name}")
                    }
                }
            } catch (e: Exception) {
                notifyStatus("Error: ${e.message}")
            } finally {
                screenshotManager?.stop()
                projection?.stop()
                instance = null
            }
        }
    }

    override fun onDestroy() {
        overlay?.dismiss()
        serviceLifecycleOwner.stop()
        screenshotManager?.stop()
        projection?.stop()
        ocrEngine?.close()
        instance = null
        super.onDestroy()
    }

    private fun notifyStatus(message: String) {
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
            "Gacha General",
            "Gacha Pickup Supporter"
        )
    }
}
