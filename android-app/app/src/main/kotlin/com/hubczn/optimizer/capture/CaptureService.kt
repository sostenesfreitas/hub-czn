package com.hubczn.optimizer.capture

import android.app.NotificationChannel
import android.app.NotificationManager
import android.app.Service
import android.content.Context
import android.content.Intent
import android.media.projection.MediaProjection
import android.media.projection.MediaProjectionManager
import android.os.IBinder
import androidx.core.app.NotificationCompat
import com.hubczn.optimizer.data.repository.JSONExporter
import com.hubczn.optimizer.logic.CombatantScanner
import com.hubczn.optimizer.logic.MemoryFragmentScanner
import com.hubczn.optimizer.logic.RescueRecordScanner
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

class CaptureService : Service() {

    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private var projection: MediaProjection? = null
    private var screenshotManager: ScreenshotManager? = null
    private var ocrEngine: MLKitOCREngine? = null

    enum class ScanType { RESCUE_RECORDS, MEMORY_FRAGMENTS, COMBATANTS }

    override fun onBind(intent: Intent?): IBinder? = null

    override fun onCreate() {
        super.onCreate()
        startForeground(NOTIF_ID, buildNotification("CZN Scanner running"))
        ocrEngine = MLKitOCREngine()
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        val projectionResultCode = intent?.getIntExtra(EXTRA_RESULT_CODE, -1) ?: return START_NOT_STICKY
        val projectionData = intent.getParcelableExtra<Intent>(EXTRA_PROJECTION_DATA) ?: return START_NOT_STICKY
        val scanType = intent.getSerializableExtra(EXTRA_SCAN_TYPE) as? ScanType ?: return START_NOT_STICKY

        val projectionManager = getSystemService(Context.MEDIA_PROJECTION_SERVICE) as MediaProjectionManager
        projection = projectionManager.getMediaProjection(projectionResultCode, projectionData)

        screenshotManager = ScreenshotManager(this, projection!!).also { it.start() }

        val accessibilityService = CZNAccessibilityService.instance
        if (accessibilityService == null) {
            notifyStatus("Accessibility Service not enabled")
            stopSelf()
            return START_NOT_STICKY
        }

        val gestures = GestureDispatcher(accessibilityService)
        val exporter = JSONExporter(this)

        scope.launch {
            try {
                when (scanType) {
                    ScanType.RESCUE_RECORDS -> {
                        val records = RescueRecordScanner(screenshotManager!!, ocrEngine!!, gestures) {
                            notifyStatus(it)
                        }.scan()
                        val file = exporter.exportRescueRecords(records, "")
                        notifyStatus("Exported ${records.size} records to ${file.name}")
                    }
                    ScanType.MEMORY_FRAGMENTS -> {
                        val fragments = MemoryFragmentScanner(screenshotManager!!, ocrEngine!!, gestures) {
                            notifyStatus(it)
                        }.scan()
                        val file = exporter.exportFragments(fragments)
                        notifyStatus("Exported ${fragments.size} fragments to ${file.name}")
                    }
                    ScanType.COMBATANTS -> {
                        val combatants = CombatantScanner(screenshotManager!!, ocrEngine!!, gestures) {
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

        instance = this
        return START_NOT_STICKY
    }

    override fun onDestroy() {
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
    }
}
