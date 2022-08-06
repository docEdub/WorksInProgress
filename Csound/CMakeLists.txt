cmake_minimum_required(VERSION 3.17)

get_filename_component(ROOT_DIR "${CMAKE_SOURCE_DIR}/.." ABSOLUTE)
get_filename_component(PROJECT_DIR "${CMAKE_SOURCE_DIR}/.." ABSOLUTE)

get_filename_component(PROJECT_NAME "${PROJECT_DIR}" NAME)
project("${PROJECT_NAME}")

include("${CMAKE_SOURCE_DIR}/Udos/PositionUdos.cmake")

include("${ROOT_DIR}/CsoundCMake/CsoundCMake.cmake")
find_package(CsoundCMake.Cabbage REQUIRED)

include("${CMAKE_SOURCE_DIR}/Udos/SynthUdos.cmake")

add_csd_targets(
    EFFECT_PLUGIN_SOURCES
        "DawService/DawService.csd"
        "Effects/BusHead.csd"
        "Effects/MasterHead.csd"
        "Effects/Reverb.csd"
        "Effects/Spatializer.csd"
    SYNTH_PLUGIN_SOURCES
        "Synths/Saw1RimSynth.csd"
        "Synths/Saw2FlyerSynth.csd"
        "Synths/TR_808.csd"
        "Synths/Triangle1Synth.csd"
        "Synths/Triangle2Synth.csd"
        "Synths/Triangle3MonoSynth.csd"
        "Synths/Triangle4BassMonoSynth.csd"
        "Synths/TriangleUdoTriggerSynth.csd"
    STANDALONE_SOURCES
        "DawService/ReloadOrcFiles.csd"
    PLAYBACK_SOURCES
        "DawPlayback/DawPlayback.csd"
)

# If the Build_InlineIncludes options is off, make sure the _.build/inlined/_.configured folder gets made so the
# DAW service has somehwere to put the files generated for playback.
if("${Build_InlineIncludes}" STREQUAL "OFF")
    file(MAKE_DIRECTORY "${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}")
endif()
