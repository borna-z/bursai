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

# Placeholder source so `add_library` has something to compile. All real
# sources (`BursGarmentDetectorOnLoad.cpp`, the spec C++ shims) are added by
# the nitrogen-generated autolinking.cmake via `target_sources(...)` below.
add_library(${PACKAGE_NAME} SHARED placeholder.cpp)

# Apply nitrogen-generated wiring: include dirs, source list, prefab finds,
# `target_link_libraries` for fbjni / ReactAndroid / nitro-modules. Paths
# inside this file are relative to `CMAKE_SOURCE_DIR` (= this file's dir).
include(${CMAKE_SOURCE_DIR}/../nitrogen/generated/android/BursGarmentDetector+autolinking.cmake)
