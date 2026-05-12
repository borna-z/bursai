package me.burs.app.livescan

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

/**
 * Wave R-A: placeholder [ReactPackage] so the Expo config plugin
 * (`mobile/plugins/with-garment-detector/index.js`) can register us in the
 * auto-generated `MainApplication.kt` alongside the other RN packages.
 *
 * The actual Nitro module (`HybridGarmentDetector`) auto-registers via the
 * nitrogen-generated `BursGarmentDetectorOnLoad.kt` which calls
 * `initializeNative()` on JNI load — so we don't expose anything via the
 * classic ReactPackage bridge here.
 */
class GarmentDetectorPackage : ReactPackage {
    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): MutableList<NativeModule> = mutableListOf()

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): MutableList<ViewManager<*, *>> = mutableListOf()
}
