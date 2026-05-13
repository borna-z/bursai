//
//  BackgroundRemoval.swift — Wave R-B
//
//  iOS subject-segmentation native module. Wraps Apple Vision's
//  `VNGenerateForegroundInstanceMaskRequest` (iOS 17+).
//
//  iOS 15/16: returns status='unavailable' immediately. The Vision API
//  used here did not exist before iOS 17; rather than ship a degraded
//  fallback path that would silently produce inferior cutouts, we let
//  the JS layer fall back to the raw URI.
//
//  Contract (matches mobile/src/lib/backgroundRemoval.ts):
//    maskImage(uri) -> Promise<{
//      uri: string,
//      status: 'masked' | 'unavailable' | 'failed',
//      confidence: number,
//      durationMs: number
//    }>
//

import Foundation
import UIKit
import Vision
import CoreImage

@objc(BackgroundRemoval)
class BackgroundRemoval: NSObject {

  // Min mean alpha for a result to be considered usable. Below this we
  // return the raw URI with status='failed'. Mirrors the JS-side
  // MASK_CONFIDENCE_THRESHOLD constant.
  private static let minConfidence: Double = 0.5

  // Target longest side. 1024 matches the JS resize pipeline so the
  // masked output flows through `uploadManipulatedImage` without a
  // second resize pass.
  private static let targetMaxDim: CGFloat = 1024

  // WebP would require a third-party encoder; HEIC is iOS-native and
  // matches the masked output's alpha channel needs. The JS pipeline
  // stamps the storage path with `.webp` either way (the storage API
  // accepts whatever bytes we feed) — but the canonical content-type
  // would mismatch. Use PNG for transparent-background fidelity; the
  // JS upload helper sets contentType from the storage path so we pick
  // an extension the helper understands.
  //
  // Update: the JS upload helper hardcodes `image/webp` MIME and
  // `.webp` extension. For consistency with that pipeline, we encode
  // PNG bytes here but the wrapper will re-transcode to WebP on the
  // JS side via expo-image-manipulator before storage upload. That
  // keeps a single MIME contract end-to-end.
  private let context = CIContext(options: nil)

  @objc(prepare:withRejecter:)
  func prepare(resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    // No warm-up work for Vision — the request is created per-call and
    // there's no model-download step. Resolve immediately so the JS
    // layer can treat both platforms uniformly.
    resolve(nil)
  }

  @objc(maskImage:withResolver:withRejecter:)
  func maskImage(uri: String, resolve: @escaping RCTPromiseResolveBlock, reject: @escaping RCTPromiseRejectBlock) {
    let started = Date()

    // iOS 15/16: no Vision subject lifting available.
    guard #available(iOS 17.0, *) else {
      resolve(self.buildResult(uri: uri, status: "unavailable", confidence: 0, startedAt: started))
      return
    }

    DispatchQueue.global(qos: .userInitiated).async {
      autoreleasepool {
        // Swift availability does not propagate from the outer scope through
        // escaping closures — re-state the iOS 17 guard inside so the
        // compiler accepts the Vision API references below. The outer
        // guard already handled the JS-side response for older OS
        // versions; this branch is unreachable on iOS <17 in practice.
        guard #available(iOS 17.0, *) else {
          self.resolveOnMain(resolve, self.buildResult(uri: uri, status: "unavailable", confidence: 0, startedAt: started))
          return
        }
        guard let cgImage = self.loadCGImage(from: uri) else {
          self.resolveOnMain(resolve, self.buildResult(uri: uri, status: "failed", confidence: 0, startedAt: started))
          return
        }
        let request = VNGenerateForegroundInstanceMaskRequest()
        let handler = VNImageRequestHandler(cgImage: cgImage, options: [:])
        do {
          try handler.perform([request])
        } catch {
          self.resolveOnMain(resolve, self.buildResult(uri: uri, status: "failed", confidence: 0, startedAt: started))
          return
        }
        guard let observation = request.results?.first else {
          self.resolveOnMain(resolve, self.buildResult(uri: uri, status: "failed", confidence: 0, startedAt: started))
          return
        }

        do {
          let maskPixelBuffer = try observation.generateMaskedImage(
            ofInstances: observation.allInstances,
            from: handler,
            croppedToInstancesExtent: false
          )
          // Render the mask CIImage to a UIImage, resize, and write to disk.
          let ciImage = CIImage(cvPixelBuffer: maskPixelBuffer)
          let resized = self.resizedImage(ciImage: ciImage)
          let confidence = self.meanAlpha(ciImage: resized)
          if confidence < BackgroundRemoval.minConfidence {
            self.resolveOnMain(resolve, self.buildResult(uri: uri, status: "failed", confidence: confidence, startedAt: started))
            return
          }
          if let outUri = self.writePNG(ciImage: resized) {
            self.resolveOnMain(resolve, self.buildResult(uri: outUri, status: "masked", confidence: confidence, startedAt: started))
          } else {
            self.resolveOnMain(resolve, self.buildResult(uri: uri, status: "failed", confidence: confidence, startedAt: started))
          }
        } catch {
          self.resolveOnMain(resolve, self.buildResult(uri: uri, status: "failed", confidence: 0, startedAt: started))
        }
      }
    }
  }

  // MARK: - helpers

  private func resolveOnMain(_ resolve: @escaping RCTPromiseResolveBlock, _ payload: [String: Any]) {
    DispatchQueue.main.async {
      resolve(payload)
    }
  }

  private func loadCGImage(from uriString: String) -> CGImage? {
    // RN URIs commonly arrive as `file://...` from ImagePicker or
    // camera output. We accept that and the bare-path form.
    let url: URL
    if let parsed = URL(string: uriString), parsed.scheme != nil {
      url = parsed
    } else {
      url = URL(fileURLWithPath: uriString)
    }
    guard let data = try? Data(contentsOf: url) else { return nil }
    guard let uiImage = UIImage(data: data) else { return nil }
    return uiImage.cgImage
  }

  private func resizedImage(ciImage: CIImage) -> CIImage {
    let extent = ciImage.extent
    let longest = max(extent.width, extent.height)
    if longest <= BackgroundRemoval.targetMaxDim { return ciImage }
    let scale = BackgroundRemoval.targetMaxDim / longest
    return ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
  }

  private func meanAlpha(ciImage: CIImage) -> Double {
    // Codex P2 round 1 — mask-quality metric, NOT garment-occupancy.
    //
    // Previously this returned mean alpha across the whole transparent
    // canvas, which collapses to "what fraction of the frame the garment
    // covers." A perfectly segmented item filling 30% of a frame reported
    // confidence 0.3 and got rejected as `failed` — making on-device
    // removal silently fall back to raw for the most common LiveScan
    // framings. Same bug existed in the Android module; fixed in parallel.
    //
    // The correct signal is "how decisive is the mask over the pixels
    // the segmenter believes are foreground?" — i.e., mean alpha over
    // pixels with alpha above a noise floor. A clean cutout has nearly
    // every foreground pixel at α≈255 and reports ~1.0; an uncertain mask
    // spreads alpha across partially-transparent edges and reports lower.
    // Independent of how much of the frame the garment fills.
    //
    // The foreground-fraction guard surfaces "no garment detected": if
    // essentially no pixels cross the noise floor, the segmenter
    // produced nothing useful and we report 0 → JS layer falls back to
    // raw bytes.
    let downscaleSize: CGFloat = 64
    let extent = ciImage.extent
    let scale = downscaleSize / max(extent.width, extent.height)
    let scaled = ciImage.transformed(by: CGAffineTransform(scaleX: scale, y: scale))
    let bounds = scaled.extent.integral

    guard let cg = context.createCGImage(scaled, from: bounds) else { return 0 }
    let w = cg.width
    let h = cg.height
    if w == 0 || h == 0 { return 0 }
    let bytesPerRow = 4 * w
    var buffer = [UInt8](repeating: 0, count: bytesPerRow * h)
    guard let colorSpace = CGColorSpace(name: CGColorSpace.sRGB) else { return 0 }
    let bitmapInfo = CGImageAlphaInfo.premultipliedLast.rawValue
    guard let ctx = CGContext(
      data: &buffer,
      width: w,
      height: h,
      bitsPerComponent: 8,
      bytesPerRow: bytesPerRow,
      space: colorSpace,
      bitmapInfo: bitmapInfo
    ) else { return 0 }
    ctx.draw(cg, in: CGRect(x: 0, y: 0, width: w, height: h))

    let foregroundAlphaFloor: UInt8 = 16 // < 16 = background / edge noise
    let minForegroundFraction: Double = 0.01 // < 1% foreground = no subject
    var foregroundAlphaSum: UInt64 = 0
    var foregroundCount: UInt64 = 0
    var sampledCount: UInt64 = 0
    var i = 3
    while i < buffer.count {
      let alpha = buffer[i]
      sampledCount += 1
      if alpha >= foregroundAlphaFloor {
        foregroundAlphaSum += UInt64(alpha)
        foregroundCount += 1
      }
      i += 4
    }
    if sampledCount == 0 { return 0 }
    let foregroundFraction = Double(foregroundCount) / Double(sampledCount)
    if foregroundFraction < minForegroundFraction { return 0 }
    if foregroundCount == 0 { return 0 }
    return min(1.0, Double(foregroundAlphaSum) / (Double(foregroundCount) * 255.0))
  }

  private func writePNG(ciImage: CIImage) -> String? {
    let extent = ciImage.extent.integral
    guard let cg = context.createCGImage(ciImage, from: extent) else { return nil }
    let uiImage = UIImage(cgImage: cg)
    guard let pngData = uiImage.pngData() else { return nil }
    let dir = FileManager.default.temporaryDirectory.appendingPathComponent("bg-removal", isDirectory: true)
    do {
      try FileManager.default.createDirectory(at: dir, withIntermediateDirectories: true, attributes: nil)
    } catch {
      return nil
    }
    let file = dir.appendingPathComponent("masked-\(Int(Date().timeIntervalSince1970 * 1000)).png")
    do {
      try pngData.write(to: file, options: .atomic)
    } catch {
      return nil
    }
    return file.absoluteString
  }

  private func buildResult(uri: String, status: String, confidence: Double, startedAt: Date) -> [String: Any] {
    let durationMs = Date().timeIntervalSince(startedAt) * 1000.0
    return [
      "uri": uri,
      "status": status,
      "confidence": confidence,
      "durationMs": durationMs,
    ]
  }

  @objc static func requiresMainQueueSetup() -> Bool {
    return false
  }
}
