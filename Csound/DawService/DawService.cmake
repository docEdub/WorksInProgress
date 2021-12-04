
include("${CsoundCMake.Cabbage_DIR}/CsoundCMake.CabbageConfig.cmake")

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
set(CSD_SOURCE_FILE_PATH "${CSD_SOURCE_DIR}/DawService.csd")
get_generated_csd_dirs(CSD_CONFIGURED_FILES_DIR CSD_PREPROCESSED_FILES_DIR "${CSD_SOURCE_FILE_PATH}")

# Set main Cabbage form width and height.
#
set(form_width 1000)
set(form_height 640)

include("${CsoundCMake.Cabbage_DIR}/Source/ui/Tab.cmake")

add_tab(mode_tab "Mode" 64)
add_tab(log_tab "Log" 64)
process_tabs()


set(tab_group_y MATH "${padding}")
set(tab_group_bottom MATH "${tab_group_y} + ${tab_height}")
set(tab_group_rect "0, ${tab_group_y}, ${form_width}, ${tab_height}")

set(tab_content_group_y MATH "${tab_group_bottom} + ${padding}")
set(tab_content_group_height MATH "${form_height} - ${tab_group_bottom}")
set(tab_content_group_size "${form_width}, ${tab_content_group_height}")
set(tab_content_group_rect "0, ${tab_content_group_y}, ${tab_content_group_size}")

set(tab_content_rect "0, 0, ${tab_content_group_size}")

set(button_count 4)
set(button_width MATH "180 - (2 * ${padding})")
set(button_height MATH "(${tab_content_group_height} - (${button_count} * (${padding} + 1))) / ${button_count}")

set(button1_x "${padding}")
set(button1_y "${padding}")
set(button2_x "${padding}")
set(button2_y MATH "${button1_y} + ${button_height} + ${padding}")
set(button3_x "${padding}")
set(button3_y MATH "${button2_y} + ${button_height} + ${padding}")
set(button4_x "${padding}")
set(button4_y MATH "${button3_y} + ${button_height} + ${padding}")

# Abbreviations
set(form_size "${form_width}, ${form_height}")
set(button1_xy "${button1_x}, ${button1_y}")
set(button2_xy "${button2_x}, ${button2_y}")
set(button3_xy "${button3_x}, ${button3_y}")
set(button4_xy "${button4_x}, ${button4_y}")
set(button_size "${button_width}, ${button_height}")

# Widgets
set(mode_button "${button} colour:0(${dark_grey}) radiogroup(\"mode\") automatable(0)")
