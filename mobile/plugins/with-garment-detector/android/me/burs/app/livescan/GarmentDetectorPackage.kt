package me.burs.app.livescan

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager
import com.margelo.nitro.burs.BursGarmentDetectorOnLoad

/**
 * Wave R-A: placeholder [ReactPackage] whose only job is to drive Nitro's
 * native-side registration. The Expo config plugin
 * (`mobile/plugins/with-garment-detector/index.js`) registers this package in
 * the auto-generated `MainApplication.kt` alongside the other RN packages so
 * its constructor runs at app startup.
 *
 * The constructor calls [BursGarmentDetectorOnLoad.initializeNative] — that
 * nitrogen-generated entry point does the `System.loadLibrary` + native
 * `registerAllNatives()` dance which installs the `GarmentDetector` Hybrid
 * Object constructor into Nitro's registry. Without this, the JS-side
 * `NitroModules.createHybridObject('GarmentDetector')` call has nothing to
 * resolve and LiveScan would crash on first frame.
 *
 * `initializeNative()` is idempotent, so re-instantiating this package (e.g.
 * during Reanimated dev reloads) is harmless.
 */
class GarmentDetectorPackage : ReactPackage {
    init {
        BursGarmentDetectorOnLoad.initializeNative()
    }

    override fun createNativeModules(
        reactContext: ReactApplicationContext,
    ): MutableList<NativeModule> = mutableListOf()

    override fun createViewManagers(
        reactContext: ReactApplicationContext,
    ): MutableList<ViewManager<*, *>> = mutableListOf()
}
