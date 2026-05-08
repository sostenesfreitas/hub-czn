package com.hubczn.optimizer.capture

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.os.Handler
import android.os.Looper
import android.util.DisplayMetrics
import android.view.WindowManager
import kotlinx.coroutines.delay

class ScreenshotManager(
    private val context: Context,
    private val projection: MediaProjection
) {
    private var imageReader: ImageReader? = null
    private var virtualDisplay: VirtualDisplay? = null
    private var currentWidth = 0
    private var currentHeight = 0
    private var currentDensity = 0

    @Suppress("DEPRECATION")
    private fun fetchMetrics(): DisplayMetrics {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        return DisplayMetrics().also { wm.defaultDisplay.getRealMetrics(it) }
    }

    fun start() {
        projection.registerCallback(object : MediaProjection.Callback() {
            override fun onStop() {
                stop()
            }
        }, Handler(Looper.getMainLooper()))
        recreatePipeline()
    }

    /**
     * (Re)creates the ImageReader + VirtualDisplay using the device's
     * current display metrics. Called on start and whenever capture()
     * detects an orientation/size change.
     */
    private fun recreatePipeline() {
        val m = fetchMetrics()
        // Release any previous pipeline.
        virtualDisplay?.release()
        imageReader?.close()

        currentWidth = m.widthPixels
        currentHeight = m.heightPixels
        currentDensity = m.densityDpi

        imageReader = ImageReader.newInstance(
            currentWidth, currentHeight, PixelFormat.RGBA_8888, 2
        )
        virtualDisplay = projection.createVirtualDisplay(
            "CZNScanner",
            currentWidth, currentHeight, currentDensity,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader!!.surface, null, null
        )
    }

    suspend fun capture(): Bitmap? {
        delay(300) // wait for screen to settle after gesture

        // Detect orientation/size change between captures and rebuild the
        // VirtualDisplay so the captured bitmap matches the live screen.
        // Without this, switching from portrait (where MediaProjection was
        // started) to landscape (in-game) leaves us capturing rotated /
        // mis-sized frames and tap coordinates desync.
        val m = fetchMetrics()
        if (m.widthPixels != currentWidth || m.heightPixels != currentHeight) {
            android.util.Log.i("CZNScanner", "Display dims changed: ${currentWidth}x${currentHeight} -> ${m.widthPixels}x${m.heightPixels}; recreating VirtualDisplay")
            recreatePipeline()
            delay(200) // give the new VirtualDisplay a moment to start producing frames
        }

        val image = imageReader?.acquireLatestImage() ?: return null
        return try {
            val planes = image.planes
            val buffer = planes[0].buffer
            val pixelStride = planes[0].pixelStride
            val rowStride = planes[0].rowStride
            val rowPadding = rowStride - pixelStride * currentWidth
            val bitmap = Bitmap.createBitmap(
                currentWidth + rowPadding / pixelStride,
                currentHeight,
                Bitmap.Config.ARGB_8888
            )
            bitmap.copyPixelsFromBuffer(buffer)
            Bitmap.createBitmap(bitmap, 0, 0, currentWidth, currentHeight)
        } finally {
            image.close()
        }
    }

    fun stop() {
        virtualDisplay?.release()
        imageReader?.close()
        virtualDisplay = null
        imageReader = null
        currentWidth = 0
        currentHeight = 0
    }
}
