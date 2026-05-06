package com.hubczn.optimizer.capture

import android.graphics.Bitmap
import android.graphics.Rect
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.text.TextRecognition
import com.google.mlkit.vision.text.latin.TextRecognizerOptions
import com.hubczn.optimizer.model.OcrBlock
import kotlinx.coroutines.suspendCancellableCoroutine
import kotlin.coroutines.resume
import kotlin.coroutines.resumeWithException

class MLKitOCREngine {

    private val recognizer = TextRecognition.getClient(TextRecognizerOptions.DEFAULT_OPTIONS)

    suspend fun recognizeBlocks(bitmap: Bitmap): List<OcrBlock> =
        suspendCancellableCoroutine { cont ->
            val image = InputImage.fromBitmap(bitmap, 0)
            recognizer.process(image)
                .addOnSuccessListener { result ->
                    val blocks = result.textBlocks.flatMap { block ->
                        block.lines.map { line ->
                            OcrBlock(
                                text = line.text,
                                bounds = line.boundingBox ?: Rect()
                            )
                        }
                    }
                    cont.resume(blocks)
                }
                .addOnFailureListener { cont.resumeWithException(it) }
        }

    fun close() = recognizer.close()
}
