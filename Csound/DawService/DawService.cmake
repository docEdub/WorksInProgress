
include("${CsoundCMake.Cabbage_DIR}/CsoundCMake.CabbageConfig.cmake")

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
set(CSD_SOURCE_FILE_PATH "${CSD_SOURCE_DIR}/DawService.csd")
get_generated_csd_dirs(CSD_CONFIGURED_FILES_DIR CSD_PREPROCESSED_FILES_DIR "${CSD_SOURCE_FILE_PATH}")

set(log_popup_size "1265, 822")

set(button_width "164")
set(button_height "50")
set(button_group_padding MATH "4 * ${padding}")

set(form_width MATH "(2 * ${padding}) + ${button_width}")

set(reset_group_y MATH "${padding}")
set(reset_group_height MATH "${button_height} + ${padding}")
set(reset_group_bottom MATH "${reset_group_y} + ${reset_group_height} + ${padding}")
set(reset_group_size "${form_width}, ${reset_group_height}")
set(reset_group_rect "0, ${reset_group_y}, ${reset_group_size}")

set(mode_button_count 4)
set(mode_group_y MATH "${reset_group_bottom} + ${button_group_padding}")
set(mode_group_height MATH "${mode_button_count} * (${button_height} + ${padding})")
set(mode_group_bottom MATH "${mode_group_y} + ${mode_group_height} + ${padding}")
set(mode_group_size "${form_width}, ${mode_group_height}")
set(mode_group_rect "0, ${mode_group_y}, ${mode_group_size}")

set(show_log_group_y MATH "${mode_group_bottom} + ${button_group_padding}")
set(show_log_group_height MATH "${button_height} + ${padding}")
set(show_log_group_bottom MATH "${show_log_group_y} + ${show_log_group_height} + ${padding}")
set(show_log_group_size "${form_width}, ${show_log_group_height}")
set(show_log_group_rect "0, ${show_log_group_y}, ${show_log_group_size}")

set(form_height MATH "${show_log_group_bottom} + ${padding}")

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
set(daw_service_button "${button} colour:0(${dark_grey})")
set(mode_button "${daw_service_button} radiogroup(\"mode\")")
