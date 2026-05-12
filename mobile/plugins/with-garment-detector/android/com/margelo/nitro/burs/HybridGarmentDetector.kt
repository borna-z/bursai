package com.margelo.nitro.burs

import androidx.camera.core.ExperimentalGetImage
import com.google.android.gms.tasks.Tasks
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.objects.ObjectDetection
import com.google.mlkit.vision.objects.defaults.ObjectDetectorOptions
import com.margelo.nitro.camera.HybridFrameSpec
import com.margelo.nitro.camera.extensions.degrees
import com.margelo.nitro.camera.public.NativeFrame
import java.util.concurrent.TimeUnit

/**
 * Wave R-A Android Nitro module: wraps Google MLKit Object Detection so a
 * vision-camera v5 `useFrameOutput` worklet can call `detect(frame)` synchronously
 * from a JS worklet runtime and get back normalized [DetectedBox]es.
 *
 * Lives in `com.margelo.nitro.burs` to match the JNI class descriptor baked
 * into the nitrogen-generated `BursGarmentDetectorOnLoad.cpp` — the autolink
 * resolves `NitroModules.createHybridObject('GarmentDetector')` by looking up
 * `Lcom/margelo/nitro/burs/HybridGarmentDetector;` so the package name here
 * is load-bearing, not a convention.
 *
 * Lifecycle: created once per HybridObject lookup on the JS side
 * (`NitroModules.createHybridObject<GarmentDetector>('GarmentDetector')`).
 * The MLKit `ObjectDetector` client below is held for the module's lifetime —
 * it's thread-safe and cheap to keep around.
 *
 * Threading: `detect` is invoked from the vision-camera frame-processor thread
 * (a background NativeThread). Blocking on `Tasks.await(..., 50ms)` is safe there
 * and keeps the call synchronous, which is what the worklet contract requires.
 */
class HybridGarmentDetector : HybridGarmentDetectorSpec() {

    private val detector = ObjectDetection.getClient(
        ObjectDetectorOptions.Builder()
            .setDetectorMode(ObjectDetectorOptions.STREAM_MODE)
            .enableClassification()
            .build()
    )

    @OptIn(ExperimentalGetImage::class)
    override fun detect(frame: HybridFrameSpec): Array<DetectedBox> {
        val input = buildInputImage(frame) ?: return emptyArray()

        val results = try {
            Tasks.await(detector.process(input), 50, TimeUnit.MILLISECONDS)
        } catch (_: Throwable) {
            // Timeout, cancellation, or MLKit error — drop this frame.
            return emptyArray()
        }

        if (results.isEmpty()) return emptyArray()

        val w = frame.width
        val h = frame.height
        if (w <= 0.0 || h <= 0.0) return emptyArray()

        val out = ArrayList<DetectedBox>(results.size)
        for (obj in results) {
            // MLKit's default "Fashion good" label is the salient-object label
            // we care about. Keep unlabeled objects too — STREAM_MODE often
            // returns a tracked-but-unclassified object on the first few frames.
            val matches = obj.labels.isEmpty() || obj.labels.any { label ->
                label.text.equals("Fashion good", ignoreCase = true)
            }
            if (!matches) continue

            val box = obj.boundingBox
            val confidence = obj.labels.maxOfOrNull { it.confidence.toDouble() } ?: 0.5
            out.add(
                DetectedBox(
                    x = box.left.toDouble() / w,
                    y = box.top.toDouble() / h,
                    width = box.width().toDouble() / w,
                    height = box.height().toDouble() / h,
                    confidence = confidence,
                )
            )
        }
        return out.toTypedArray()
    }

    /**
     * Build an MLKit [InputImage] from a vision-camera v5 [HybridFrameSpec].
     *
     * v5's concrete [com.margelo.nitro.camera.hybrids.instances.HybridFrame]
     * implements [NativeFrame] which exposes the underlying CameraX
     * `ImageProxy`. From there we can grab the wrapped `android.media.Image`
     * (the Camera2 `Image`) and hand it to `InputImage.fromMediaImage(...)` —
     * the canonical MLKit Camera2 path. No YUV plane copy required.
     *
     * Returns null if the frame doesn't carry a NativeFrame (e.g. a synthetic
     * frame in a test or a future non-CameraX backend) or if the underlying
     * Camera2 image is unavailable. Callers treat null as "no detections".
     */
    @OptIn(ExperimentalGetImage::class)
    private fun buildInputImage(frame: HybridFrameSpec): InputImage? {
        val native = frame as? NativeFrame ?: return null
        val proxy = native.image
        val mediaImage = proxy.image ?: return null
        val rotation = frame.orientation.degrees
        return InputImage.fromMediaImage(mediaImage, rotation)
    }
}
