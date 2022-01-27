
set(InstrumentName "Triangle3MonoSynth")

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
include("${CMAKE_CURRENT_LIST_DIR}/../Common/CommonSynth.cmake")

add_csd_specific_configured_file("Common/TriangleMonoSynth.in-include-guard.orc")
add_csd_specific_configured_file("Common/TriangleMonoSynth.init.orc")
add_csd_specific_configured_file("Common/TriangleMonoSynth.instr.orc")
