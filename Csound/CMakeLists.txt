cmake_minimum_required(VERSION 3.17)

get_filename_component(ROOT_DIR "${CMAKE_SOURCE_DIR}/.." ABSOLUTE)
get_filename_component(PROJECT_DIR "${CMAKE_SOURCE_DIR}/.." ABSOLUTE)

get_filename_component(PROJECT_NAME "${PROJECT_DIR}" NAME)
project("${PROJECT_NAME}")

include("${ROOT_DIR}/CsoundCMake/CsoundCMake.cmake")
find_package(CsoundCMake.Cabbage REQUIRED)

add_csd_targets(
    EFFECT_PLUGIN_SOURCES
        "Effects/BusHead.csd"
        "Effects/MasterHead.csd"
        "Effects/Reverb.csd"
    SYNTH_PLUGIN_SOURCES
        "Synths/CircleSynth.csd"
        "Synths/DistanceDelaySynth.csd"
        "Synths/GroundBubbleSynth.csd"
        "Synths/PointSynth.csd"
        "Synths/PowerLineSynth.csd"
        "Synths/SubtractiveSynth.csd"
    STANDALONE_SOURCES
        "DawService/DawService.csd"
    PLAYBACK_SOURCES
        "DawPlayback/DawPlayback.csd"
)

# If the Build_InlineIncludes options is off, make sure the _.build/inlined/_.configured folder gets made so the
# DAW service has somehwere to put the files generated for playback.
if("${Build_InlineIncludes}" STREQUAL "OFF")
    file(MAKE_DIRECTORY "${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}")
endif()
