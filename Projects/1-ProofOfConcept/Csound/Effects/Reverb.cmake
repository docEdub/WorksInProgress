
set(form_width 1000)
set(form_height 516)

set(InstrumentName "Reverb")

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
set(CSD_SOURCE_FILE_PATH "${CSD_SOURCE_DIR}/${InstrumentName}.csd")
get_generated_csd_dirs(CSD_CONFIGURED_FILES_DIR CSD_PREPROCESSED_FILES_DIR "${CSD_SOURCE_FILE_PATH}")

include("${CsoundCMake.Cabbage_DIR}/Source/ui/S88.cmake")
include("${CsoundCMake.Cabbage_DIR}/Source/ui/Tab.cmake")
include("${CsoundCMake.Cabbage_DIR}/Source/ui/TrackInfo.cmake")

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

configure_file("${CMAKE_CURRENT_LIST_DIR}/Reverb.ui" "${CSD_CONFIGURED_FILES_DIR}/Reverb.ui")
