
include("${CsoundCMake.Cabbage_DIR}/Source/global.cmake")

set(TrackInfo_width "${form_width}")
set(TrackInfo_height "32")

set(control_y "${padding}")
set(control_height MATH "${TrackInfo_height} - (2 * ${padding})")

set(instance_name_x "${padding}")
set(instance_name_y "${control_y}")
set(instance_name_width 192)
set(instance_name_height "${control_height}")

set(track_index_x MATH "${instance_name_x} + ${instance_name_width} + ${padding}")
set(track_index_y "${control_y}")
set(track_index_width 32)
set(track_index_height "${control_height}")

set(plugin_index_x MATH "${track_index_x} + ${track_index_width} + ${padding}")
set(plugin_index_y "${control_y}")
set(plugin_index_width 32)
set(plugin_index_height "${control_height}")

set(mode_label_width MATH "${TrackInfo_height} - (2 * ${padding})")
set(mode_label_height "${mode_label_width}")

set(mode_label_1_x MATH "${form_width} - ((4 * ${mode_label_width}) + (5 * ${padding}))")
set(mode_label_2_x MATH "${mode_label_1_x} + ${mode_label_width} + ${padding}")
set(mode_label_3_x MATH "${mode_label_2_x} + ${mode_label_width} + ${padding}")
set(mode_label_4_x MATH "${mode_label_3_x} + ${mode_label_width} + ${padding}")
set(mode_label_y "${control_y}")

# Abbreviations
set(instance_name_rect "${instance_name_x}, ${instance_name_y}, ${instance_name_width}, ${instance_name_height}")
set(track_index_rect "${track_index_x}, ${track_index_y}, ${track_index_width}, ${track_index_height}")
set(plugin_index_rect "${plugin_index_x}, ${plugin_index_y}, ${plugin_index_width}, ${plugin_index_height}")
set(mode_label_1_rect "${mode_label_1_x}, ${mode_label_y}, ${mode_label_width}, ${mode_label_height}")
set(mode_label_2_rect "${mode_label_2_x}, ${mode_label_y}, ${mode_label_width}, ${mode_label_height}")
set(mode_label_3_rect "${mode_label_3_x}, ${mode_label_y}, ${mode_label_width}, ${mode_label_height}")
set(mode_label_4_rect "${mode_label_4_x}, ${mode_label_y}, ${mode_label_width}, ${mode_label_height}")

# Widgets
set(mode_label "${label} align(\"centre\") colour(${dark_grey}) fontcolour(${white})")

set(file "ui/TrackInfo.ui")
configure_file(
    "${CsoundCMake.Cabbage_DIR}/Source/${file}"
    "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${CSOUND_CMAKE_OUTPUT_SUBDIRECTORY}/${file}")
