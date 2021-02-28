
set(form_width 1000)
set(form_height 516)

set(InstrumentName "Reverb")

get_filename_component(CSOUND_CMAKE_OUTPUT_SUBDIRECTORY "${CMAKE_CURRENT_LIST_FILE}" NAME_WE)
include("${CsoundAuger_DIR}/cabbage/S88.cmake")
include("${CsoundAuger_DIR}/cabbage/Tab.cmake")
include("${CsoundAuger_DIR}/cabbage/TrackInfo.cmake")

add_tab(reverb_tab "Reverb" 64)
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

configure_file("${CMAKE_CURRENT_LIST_DIR}/Reverb.ui" "${CSOUND_CMAKE_OUTPUT_DIR}/Reverb.ui")
