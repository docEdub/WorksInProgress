
set(form_width 1000)
set(form_height 516)

set(InstrumentName "SubtractiveSynth")

get_filename_component(CSOUND_CMAKE_OUTPUT_SUBDIRECTORY "${CMAKE_CURRENT_LIST_FILE}" NAME_WE)
include("${CsoundCMake.Cabbage_DIR}/Source/ui/Position.cmake")
include("${CsoundCMake.Cabbage_DIR}/Source/ui/S88.cmake")
include("${CsoundCMake.Cabbage_DIR}/Source/ui/Tab.cmake")
include("${CsoundCMake.Cabbage_DIR}/Source/ui/TrackInfo.cmake")

configure_file("${CMAKE_CURRENT_LIST_DIR}/SubtractiveSynth.osc.orc"
    "${CSOUND_CMAKE_OUTPUT_DIR}/SubtractiveSynth.osc.orc")


add_tab(s88_tab "S88" 64)
add_tab(osc1_tab "Osc 1" 64)
add_tab(osc2_tab "Osc 2" 64)
add_tab(osc3_tab "Osc 3" 64)
add_tab(osc4_tab "Osc 4" 64)
add_tab(filter_tab "Filter" 80)
add_tab(amplitude_tab "Amplitude" 96)
add_tab(position_tab "Position" 96)
add_tab(log_tab "Log" 64)
process_tabs()


set(tab_group_y MATH "${TrackInfo_height} + ${padding}")
set(tab_group_bottom MATH "${tab_group_y} + ${tab_height}")
set(tab_group_rect "0, ${tab_group_y}, ${form_width}, ${tab_height}")

set(tab_content_group_y MATH "${tab_group_bottom} + ${padding}")
set(tab_content_group_height MATH "${form_height} - ${tab_group_bottom}")
set(tab_content_group_size "${form_width}, ${tab_content_group_height}")
set(tab_content_group_rect "0, ${tab_content_group_y}, ${tab_content_group_size}")

set(tab_content_rect "0, 0, ${tab_content_group_size}")

macro(add_osc_controls)
    add_adsr_200x100(pulseWidthAdsrKnobs "${uiPrefix}PulseWidth")
    add_lfo_200x100(pulseWidthLfoControls "${uiPrefix}PulseWidth")
    add_adsr_200x100(pitchAdsrKnobs "${uiPrefix}Pitch")
    add_lfo_200x100(pitchLfoControls "${uiPrefix}Pitch")
    add_adsr_200x100(filterCutoffFrequencyAdsrKnobs "${uiPrefix}FilterCutoffFrequency")
    add_lfo_200x100(filterCutoffFrequencyLfoControls "${uiPrefix}FilterCutoffFrequency")
    add_adsr_200x100(filterResonanceAdsrKnobs "${uiPrefix}FilterResonance")
    add_lfo_200x100(filterResonanceLfoControls "${uiPrefix}FilterResonance")
    add_adsr_200x100(volumeAdsrKnobs "${uiPrefix}Volume")
    add_lfo_200x100(volumeLfoControls "${uiPrefix}Volume")
endmacro()

set(uiPrefix "osc1")
add_osc_controls()
configure_file("${CMAKE_CURRENT_LIST_DIR}/SubtractiveSynthOsc.ui" "${CSOUND_CMAKE_OUTPUT_DIR}/SubtractiveSynthOsc1.ui")

set(uiPrefix "osc2")
add_osc_controls()
configure_file("${CMAKE_CURRENT_LIST_DIR}/SubtractiveSynthOsc.ui" "${CSOUND_CMAKE_OUTPUT_DIR}/SubtractiveSynthOsc2.ui")

set(uiPrefix "osc3")
add_osc_controls()
configure_file("${CMAKE_CURRENT_LIST_DIR}/SubtractiveSynthOsc.ui" "${CSOUND_CMAKE_OUTPUT_DIR}/SubtractiveSynthOsc3.ui")

set(uiPrefix "osc4")
add_osc_controls()
configure_file("${CMAKE_CURRENT_LIST_DIR}/SubtractiveSynthOsc.ui" "${CSOUND_CMAKE_OUTPUT_DIR}/SubtractiveSynthOsc4.ui")

add_adsr_200x100(filterCutoffFrequencyAdsrKnobs "filterCutoffFrequency")
add_adsr_200x100(filterResonanceAdsrKnobs "filterResonance")
configure_file("${CMAKE_CURRENT_LIST_DIR}/SubtractiveSynthFilter.ui"
    "${CSOUND_CMAKE_OUTPUT_DIR}/SubtractiveSynthFilter.ui")

configure_file("${CMAKE_CURRENT_LIST_DIR}/SubtractiveSynthAmplitude.ui"
    "${CSOUND_CMAKE_OUTPUT_DIR}/SubtractiveSynthAmplitude.ui")
