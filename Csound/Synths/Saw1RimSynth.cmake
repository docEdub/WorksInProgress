
set(InstrumentName "Saw1RimSynth")

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
include("${CMAKE_CURRENT_LIST_DIR}/../Common/CommonSynth.cmake")

set(RimMesh "Rim1HiArpMesh")
include("${CMAKE_CURRENT_LIST_DIR}/Common/RimMesh.cmake")
add_csd_specific_configured_file("Common/RimMesh.orc")
