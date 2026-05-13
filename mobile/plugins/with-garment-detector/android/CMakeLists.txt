# Wave R-A: BursGarmentDetector Nitro native library.
#
# Copied into `android/CMakeLists.txt` by `withGarmentDetectorCmake` on
# expo prebuild, then referenced from `android/app/build.gradle`'s
# `externalNativeBuild { cmake { path "../CMakeLists.txt" } }` block.
#
# The target name (`BursGarmentDetector`) is load-bearing: nitrogen-generated
# `BursGarmentDetectorOnLoad.kt` does `System.loadLibrary("BursGarmentDetector")`
# and `BursGarmentDetectorOnLoad.cpp` registers itself at JNI_OnLoad time.
#
# Placement note: this CMakeLists.txt MUST live at `android/CMakeLists.txt`
# (one level above `:app`) so the nitrogen-generated autolinking.cmake's
# `../nitrogen/...` relative paths resolve correctly to `mobile/nitrogen/`.
project(BursGarmentDetector)
cmake_minimum_required(VERSION 3.9.0)

set(PACKAGE_NAME BursGarmentDetector)
set(CMAKE_CXX_STANDARD 20)

# Seed source: cpp-adapter.cpp defines `JNI_OnLoad` which calls
# `margelo::nitro::burs::registerAllNatives()` to install the
# `GarmentDetector` HybridObject constructor in Nitro's registry. The
# nitrogen-generated autolinking.cmake below appends the rest of the .cpp
# files (BursGarmentDetectorOnLoad.cpp, spec shims) to the same target.
add_library(${PACKAGE_NAME} SHARED cpp-adapter.cpp)

# Resolve the VisionCamera prefab BEFORE pulling in the nitrogen-generated
# wiring. The generated `JHybridGarmentDetectorSpec.cpp` `#include`s
# `<VisionCamera/HybridFrameSpec.hpp>` and `<VisionCamera/JHybridFrameSpec.hpp>`
# for the `Frame` parameter type — those headers come from the VisionCamera
# prefab. Calling `find_package` first guarantees the imported target exists
# when `target_link_libraries` below propagates its `INTERFACE_INCLUDE_DIRECTORIES`
# to the BursGarmentDetector compile commands. Mirrors the wiring documented
# in `node_modules/react-native-vision-camera/docs/.../FRAME_PROCESSORS_NITRO.mdx`.
find_package(react-native-vision-camera REQUIRED)
target_link_libraries(
    ${PACKAGE_NAME}
    react-native-vision-camera::VisionCamera
)

# Apply nitrogen-generated wiring: include dirs, source list, prefab finds,
# `target_link_libraries` for fbjni / ReactAndroid / nitro-modules. Paths
# inside this file are relative to `CMAKE_SOURCE_DIR` (= this file's dir).
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/BursGarmentDetector+autolinking.cmake)
