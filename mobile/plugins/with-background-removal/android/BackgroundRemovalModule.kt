package me.burs.app.bgremoval

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.bridge.WritableMap
import com.facebook.react.bridge.Arguments
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.subject.Subject
import com.google.mlkit.vision.segmentation.subject.SubjectSegmentation
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenter
import com.google.mlkit.vision.segmentation.subject.SubjectSegmenterOptions
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min

/**
 * Wave R-B — Android subject-segmentation native module.
 *
 * Wraps MLKit Subject Segmentation (`com.google.mlkit:subject-segmentation`),
 * which is a beta API but exposes a stable promise-based surface usable
 * from RN. The module runs on RN's native module thread (NOT a worklet
 * thread), so the bridgeless / vc-worklets conflict that killed R-A's
 * frame-processor path does not apply here.
 *
 * Contract (matches `mobile/src/lib/backgroundRemoval.ts`):
 *   maskImage(uri) -> Promise<{
 *     uri: string,
 *     status: 'masked' | 'unavailable' | 'failed',
 *     confidence: number,
 *     durationMs: number
 *   }>
 *
 * Any thrown / failure path resolves with `status='failed'` and the
 * original URI so the JS layer always gets a usable image.
 */
class BackgroundRemovalModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

    companion object {
        private const val TAG = "BackgroundRemoval"
        // Mean alpha quality gate — mirrors the JS-side documentation.
        // Below this, the result is dropped and we return the raw URI.
        private const val MIN_CONFIDENCE = 0.5
        // Target longest side for the masked output. Matches the JS
        // pipeline's WebP target (1024px) so the masked path can flow
        // through `uploadManipulatedImage` without an extra resize.
        private const val TARGET_MAX_DIM = 1024
        // WebP quality. 80 keeps file size ~80KB with imperceptible loss
        // on a transparent-background cutout.
        private const val WEBP_QUALITY = 80
    }

    @Volatile
    private var segmenter: SubjectSegmenter? = null

    override fun getName(): String = "BackgroundRemoval"

    /**
     * Close the cached segmenter when RN tears down the bridge (sign-out,
     * hot reload, app termination on Android <13). MLKit's `SubjectSegmenter`
     * implements `Closeable`; leaking it across catalyst-instance lifecycles
     * triggers warning logs and pins a few MB of off-heap memory per
     * recreate. Idempotent.
     */
    override fun invalidate() {
        try {
            segmenter?.close()
        } catch (_: Throwable) {
            // Ignore — closing a closed client throws and is harmless.
        } finally {
            segmenter = null
        }
        super.invalidate()
    }

    @ReactMethod
    fun prepare(promise: Promise) {
        try {
            ensureSegmenter()
            promise.resolve(null)
        } catch (e: Throwable) {
            // Warm-up failure is non-fatal; first real call will retry.
            Log.w(TAG, "prepare() failed", e)
            promise.resolve(null)
        }
    }

    @ReactMethod
    fun maskImage(uriString: String, promise: Promise) {
        val started = System.currentTimeMillis()
        try {
            val srcBitmap = loadBitmap(uriString)
            if (srcBitmap == null) {
                promise.resolve(buildResult(uriString, "failed", 0.0, started))
                return
            }

            val segmenterRef = ensureSegmenter()
            val input = InputImage.fromBitmap(srcBitmap, 0)

            segmenterRef.process(input)
                .addOnSuccessListener { result ->
                    try {
                        val output = buildMaskedBitmap(srcBitmap, result.subjects)
                        if (output == null) {
                            promise.resolve(buildResult(uriString, "failed", 0.0, started))
                            return@addOnSuccessListener
                        }
                        if (output.confidence < MIN_CONFIDENCE) {
                            output.bitmap.recycle()
                            promise.resolve(buildResult(uriString, "failed", output.confidence, started))
                            return@addOnSuccessListener
                        }
                        val maskedUri = writeWebp(output.bitmap)
                        output.bitmap.recycle()
                        promise.resolve(buildResult(maskedUri ?: uriString, if (maskedUri != null) "masked" else "failed", output.confidence, started))
                    } catch (e: Throwable) {
                        Log.w(TAG, "post-segmentation failure", e)
                        promise.resolve(buildResult(uriString, "failed", 0.0, started))
                    } finally {
                        srcBitmap.recycle()
                    }
                }
                .addOnFailureListener { e ->
                    Log.w(TAG, "segmentation failed", e)
                    srcBitmap.recycle()
                    promise.resolve(buildResult(uriString, "failed", 0.0, started))
                }
        } catch (e: Throwable) {
            Log.w(TAG, "maskImage threw", e)
            promise.resolve(buildResult(uriString, "failed", 0.0, started))
        }
    }

    private fun ensureSegmenter(): SubjectSegmenter {
        val cached = segmenter
        if (cached != null) return cached
        synchronized(this) {
            val again = segmenter
            if (again != null) return again
            val options = SubjectSegmenterOptions.Builder()
                .enableForegroundConfidenceMask()
                .enableForegroundBitmap()
                .build()
            val created = SubjectSegmentation.getClient(options)
            segmenter = created
            return created
        }
    }

    private fun loadBitmap(uriString: String): Bitmap? {
        return try {
            val uri = Uri.parse(uriString)
            val scheme = uri.scheme
            val opts = BitmapFactory.Options().apply {
                inMutable = false
                inPreferredConfig = Bitmap.Config.ARGB_8888
            }
            when (scheme) {
                "content" -> {
                    reactApplicationContext.contentResolver.openInputStream(uri)?.use {
                        BitmapFactory.decodeStream(it, null, opts)
                    }
                }
                "file", null -> {
                    val path = uri.path ?: uriString
                    BitmapFactory.decodeFile(path, opts)
                }
                else -> null
            }
        } catch (e: Throwable) {
            Log.w(TAG, "loadBitmap failed for $uriString", e)
            null
        }
    }

    private data class MaskOutput(val bitmap: Bitmap, val confidence: Double)

    private fun buildMaskedBitmap(src: Bitmap, subjects: List<Subject>): MaskOutput? {
        // MLKit's foreground bitmap from `SubjectSegmenterOptions.enableForegroundBitmap()`
        // returns a single composite mask of all detected subjects against
        // a transparent background, sized to the input. We just need to
        // resize it down to TARGET_MAX_DIM and read the mean alpha for
        // the confidence gate.
        //
        // If `subjects` is empty MLKit still hands back a usable
        // (probably empty / very-low-alpha) foreground bitmap. Reading
        // mean alpha lets us reject empty masks without special-casing.
        if (subjects.isEmpty()) return null

        // Combine all subject masks by alpha-max. We rely on the segmenter
        // having already produced the combined `foregroundBitmap` view —
        // but we still need to extract per-subject confidence to gate.
        // SubjectSegmenter doesn't surface per-subject confidence in
        // 16.0.0-beta1, so we approximate by reading mean alpha of the
        // resized output. This is a documented limitation; tune the
        // MIN_CONFIDENCE threshold from device tests if needed.
        val combined = combineForegrounds(src, subjects) ?: return null

        val scale = TARGET_MAX_DIM.toFloat() / max(combined.width, combined.height).toFloat()
        val scaled = if (scale < 1.0f) {
            val w = max(1, (combined.width * scale).toInt())
            val h = max(1, (combined.height * scale).toInt())
            Bitmap.createScaledBitmap(combined, w, h, true).also {
                if (it !== combined) combined.recycle()
            }
        } else {
            combined
        }

        val confidence = meanAlpha(scaled)
        return MaskOutput(scaled, confidence)
    }

    /**
     * Composite every detected subject's foreground bitmap on top of
     * a transparent canvas the size of the source. SubjectSegmenter
     * returns one `foregroundBitmap` per subject (when enabled in
     * options); the combined output preserves multi-subject items
     * (e.g. a top + accessory framed together).
     */
    private fun combineForegrounds(src: Bitmap, subjects: List<Subject>): Bitmap? {
        // Allocate transparent canvas sized to the source.
        val canvas = Bitmap.createBitmap(src.width, src.height, Bitmap.Config.ARGB_8888)
        val androidCanvas = android.graphics.Canvas(canvas)
        var anyDrawn = false
        for (subject in subjects) {
            val fg = subject.bitmap ?: continue
            val left = subject.startX
            val top = subject.startY
            androidCanvas.drawBitmap(fg, left.toFloat(), top.toFloat(), null)
            anyDrawn = true
        }
        if (!anyDrawn) {
            canvas.recycle()
            return null
        }
        return canvas
    }

    private fun meanAlpha(bitmap: Bitmap): Double {
        // Sample every Nth pixel to keep the mean-alpha computation cheap
        // on 1024×1024 inputs (~1M pixels would be 4MB of ARGB reads).
        // Stride of 8 keeps it under ~16K pixel reads, still statistically
        // representative for a quality gate.
        val stride = 8
        var total = 0L
        var count = 0L
        for (y in 0 until bitmap.height step stride) {
            for (x in 0 until bitmap.width step stride) {
                val pixel = bitmap.getPixel(x, y)
                val alpha = (pixel ushr 24) and 0xff
                total += alpha
                count += 1
            }
        }
        if (count == 0L) return 0.0
        return min(1.0, total.toDouble() / (count.toDouble() * 255.0))
    }

    private fun writeWebp(bitmap: Bitmap): String? {
        return try {
            val outDir = File(reactApplicationContext.cacheDir, "bg-removal")
            if (!outDir.exists()) outDir.mkdirs()
            val outFile = File(outDir, "masked-${System.currentTimeMillis()}.webp")
            FileOutputStream(outFile).use { fos ->
                // `WEBP_LOSSY` preserves the transparent channel and keeps
                // file size small. Pre-API-30 still ships `WEBP` (lossless
                // alpha-aware), but lossless is overkill for a 1024px
                // cutout — file size triples for negligible visual gain.
                @Suppress("DEPRECATION")
                bitmap.compress(Bitmap.CompressFormat.WEBP, WEBP_QUALITY, fos)
            }
            "file://${outFile.absolutePath}"
        } catch (e: Throwable) {
            Log.w(TAG, "writeWebp failed", e)
            null
        }
    }

    private fun buildResult(uri: String, status: String, confidence: Double, startedAt: Long): WritableMap {
        val map: WritableMap = Arguments.createMap()
        map.putString("uri", uri)
        map.putString("status", status)
        map.putDouble("confidence", confidence)
        map.putDouble("durationMs", (System.currentTimeMillis() - startedAt).toDouble())
        return map
    }
}
