cmake_minimum_required(VERSION 3.17)

get_filename_component(ROOT_DIR "${CMAKE_SOURCE_DIR}/../../.." ABSOLUTE)
get_filename_component(PROJECT_DIR "${CMAKE_SOURCE_DIR}/.." ABSOLUTE)

get_filename_component(PROJECT_NAME "${PROJECT_DIR}" NAME)
project("${PROJECT_NAME}")

include("${ROOT_DIR}/Libraries/CsoundCMake/CsoundCMake.cmake")
find_package(CsoundCMake.Cabbage REQUIRED)

add_csd("DawService.csd")
add_csd_effect("Effects/BusHead.csd")
add_csd_effect("Effects/MasterHead.csd")
add_csd_effect("Effects/Reverb.csd")
add_csd_synth("Synths/SubtractiveSynth.csd")
