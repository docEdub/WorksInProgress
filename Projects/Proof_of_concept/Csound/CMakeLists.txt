cmake_minimum_required(VERSION 3.17)

get_filename_component(project_name "${CMAKE_CURRENT_SOURCE_DIR}" NAME)
project("${project_name}")

set(ROOT_SOURCE_DIR "${CMAKE_CURRENT_SOURCE_DIR}/..")
include("${ROOT_SOURCE_DIR}/project.cmake")

add_csd("daw-service.csd")
# add_csd("log-testing.csd")
# add_csd("pianoteq_01.csd")
# add_csd("s88_test_01.csd")
add_csd_effect("TestBusHead.csd")
add_csd_effect("TestEffect.csd")
add_csd_effect("TestMasterHead.csd")
add_csd_synth("TestSynth.csd")
add_csd("TestSynth_playback.csd")
add_csd_synth("SubtractiveSynth.csd")
add_csd_effect("Reverb.csd")