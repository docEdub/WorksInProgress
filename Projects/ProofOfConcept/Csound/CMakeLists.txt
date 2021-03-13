cmake_minimum_required(VERSION 3.17)

get_filename_component(ROOT_DIR "${CMAKE_SOURCE_DIR}/../../.." ABSOLUTE)
get_filename_component(PROJECT_DIR "${CMAKE_SOURCE_DIR}/.." ABSOLUTE)

get_filename_component(PROJECT_NAME "${PROJECT_DIR}" NAME)
project("${PROJECT_NAME}")

include("${ROOT_DIR}/Libraries/CsoundCMake/CsoundCMake.cmake")
find_package(CsoundCMake.Cabbage REQUIRED)

if("${BUILD_PLAYBACK_CSD}" STREQUAL "ON")
    add_csd("Playback.csd")
else()
    add_csd("DawService.csd")
    add_csd_effect("Effects/BusHead.csd")
    add_csd_effect("Effects/MasterHead.csd")
    add_csd_effect("Effects/Reverb.csd")
    add_csd_synth("Synths/SubtractiveSynth.csd")
endif()

# If the Build_InlineIncludes options is off, make sure the _.build/inlined/_.configured folder gets made so the
# DAW service has somehwere to put the files generated for playback.
if("${Build_InlineIncludes}" STREQUAL "OFF")
    file(MAKE_DIRECTORY "${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}")
endif()
