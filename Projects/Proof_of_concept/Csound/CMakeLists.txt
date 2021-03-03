cmake_minimum_required(VERSION 3.17)

include("../../Projects.cmake")

project("${PROJECT_NAME}")

add_csd("DawService.csd")
add_csd_effect("Effects/BusHead.csd")
add_csd_effect("Effects/MasterHead.csd")
add_csd_effect("Effects/Reverb.csd")
add_csd_synth("Synths/SubtractiveSynth.csd")
