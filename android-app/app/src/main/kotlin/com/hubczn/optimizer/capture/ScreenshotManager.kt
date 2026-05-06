package com.hubczn.optimizer.capture

import android.content.Context
import android.graphics.Bitmap
import android.graphics.PixelFormat
import android.hardware.display.DisplayManager
import android.hardware.display.VirtualDisplay
import android.media.ImageReader
import android.media.projection.MediaProjection
import android.util.DisplayMetrics
import android.view.WindowManager
import kotlinx.coroutines.delay

class ScreenshotManager(
    private val context: Context,
    private val projection: MediaProjection
) {
    private var imageReader: ImageReader? = null
    private var virtualDisplay: VirtualDisplay? = null

    private val metrics: DisplayMetrics by lazy {
        val wm = context.getSystemService(Context.WINDOW_SERVICE) as WindowManager
        DisplayMetrics().also { wm.defaultDisplay.getRealMetrics(it) }
    }

    fun start() {
        val width = metrics.widthPixels
        val height = metrics.heightPixels
        val density = metrics.densityDpi

        imageReader = ImageReader.newInstance(width, height, PixelFormat.RGBA_8888, 2)
        virtualDisplay = projection.createVirtualDisplay(
            "CZNScanner",
            width, height, density,
            DisplayManager.VIRTUAL_DISPLAY_FLAG_AUTO_MIRROR,
            imageReader!!.surface, null, null
        )
    }

    suspend fun capture(): Bitmap? {
        delay(300) // wait for screen to settle after gesture
        val image = imageReader?.acquireLatestImage() ?: return null
        return try {
            val planes = image.planes
            val buffer = planes[0].buffer
            val pixelStride = planes[0].pixelStride
            val rowStride = planes[0].rowStride
            val rowPadding = rowStride - pixelStride * metrics.widthPixels
            val bitmap = Bitmap.createBitmap(
                metrics.widthPixels + rowPadding / pixelStride,
                metrics.heightPixels,
                Bitmap.Config.ARGB_8888
            )
            bitmap.copyPixelsFromBuffer(buffer)
            Bitmap.createBitmap(bitmap, 0, 0, metrics.widthPixels, metrics.heightPixels)
        } finally {
            image.close()
        }
    }

    fun stop() {
        virtualDisplay?.release()
        imageReader?.close()
        virtualDisplay = null
        imageReader = null
    }
}
