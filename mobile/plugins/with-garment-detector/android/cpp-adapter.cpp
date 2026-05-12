// Wave R-A: JNI_OnLoad entry point for the BursGarmentDetector .so.
//
// The nitrogen-generated `BursGarmentDetectorOnLoad.cpp` provides
// `registerAllNatives()` (which installs the `GarmentDetector` HybridObject
// constructor in Nitro's registry) and an `initialize(JavaVM*)` helper, but
// does NOT itself define `JNI_OnLoad` — that's by design, the header doc
// instructs consumers to wire it up in a `cpp-adapter.cpp` like this one.
//
// Without this file, loading the `BursGarmentDetector` shared library via
// `System.loadLibrary` would succeed but no Hybrid Object would ever
// register, so `NitroModules.createHybridObject('GarmentDetector')` on the
// JS side would throw with "no constructor registered for ..." and the
// LiveScan Android path would crash.
//
// Compiled into the `BursGarmentDetector` lib by being the `add_library`
// seed source named in our CMakeLists.txt — the nitrogen-generated
// autolinking.cmake then appends its own .cpp files to the same target.

#include <fbjni/fbjni.h>
#include <jni.h>

#include "BursGarmentDetectorOnLoad.hpp"

JNIEXPORT jint JNICALL JNI_OnLoad(JavaVM* vm, void* /*reserved*/) {
  return facebook::jni::initialize(vm, []() {
    // Register all BursGarmentDetector HybridObjects (currently just
    // `GarmentDetector`). See the header doc on `registerAllNatives` for the
    // canonical wiring.
    margelo::nitro::burs::registerAllNatives();
  });
}
