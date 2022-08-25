
set(InstrumentName "Saw2FlyerSynth")

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
include("${CMAKE_CURRENT_LIST_DIR}/../Common/CommonSynth.cmake")

set(FlyerPath "Flyer1Path")
include("${CMAKE_CURRENT_LIST_DIR}/Common/FlyerPaths.cmake")
add_csd_specific_configured_file("Common/FlyerPaths.orc")
