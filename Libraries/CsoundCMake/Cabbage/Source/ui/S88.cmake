
include("${CsoundCMake.Cabbage_DIR}/Source/global.cmake")

define_cabbage_control_size("small")
define_cabbage_control_size("medium")
define_cabbage_control_size("large")

set(knob_count "8")
set(knob_group_width MATH "${medium_rslider_width} * ${knob_count}")
set(knob_y "${padding}")
set(knob_width "${medium_rslider_width}")
set(knob_height "${medium_rslider_height}")
set(knob_1_x MATH "(${form_width} - ${knob_group_width}) / 2")
set(knob_2_x MATH "${knob_1_x} + ${knob_width}")
set(knob_3_x MATH "${knob_2_x} + ${knob_width}")
set(knob_4_x MATH "${knob_3_x} + ${knob_width}")
set(knob_5_x MATH "${knob_4_x} + ${knob_width}")
set(knob_6_x MATH "${knob_5_x} + ${knob_width}")
set(knob_7_x MATH "${knob_6_x} + ${knob_width}")
set(knob_8_x MATH "${knob_7_x} + ${knob_width}")

set(keyboard_group_x "0")
set(keyboard_group_y MATH "${knob_y} + ${knob_height} + ${padding}")

set(pitchbend_x "0")
set(pitchbend_y "${padding}")
set(pitchbend_width MATH "(${medium_vslider_width} * 5) / 4")
set(pitchbend_height MATH "${medium_vslider_height} / 2")

set(modwheel_x MATH "${pitchbend_x} + ${pitchbend_width}")
set(modwheel_y "${pitchbend_y}")
set(modwheel_width "${pitchbend_width}")
set(modwheel_height "${pitchbend_height}")

set(keyboard_x MATH "${modwheel_x} + ${modwheel_width}")
set(keyboard_y "${pitchbend_y}")
set(keyboard_width MATH "${form_width} - (${modwheel_x} + ${modwheel_width} + (2 * ${padding}))")
# Max Cabbage keyboard width is 1200.
if(1200 LESS ${keyboard_width})
    set(keyboard_group_x MATH "(${keyboard_width} - 1200) / 2")
    set(keyboard_width 1200)
endif()
set(keyboard_height "${pitchbend_height}")

set(keyboard_group_width MATH "${keyboard_x} + ${keyboard_width} + ${padding}")
set(keyboard_group_height MATH "${keyboard_height} + (2 * ${padding})")

set(S88_width ${form_width})
set(S88_height MATH "${keyboard_group_y} + ${keyboard_group_height}")

configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/S88.ui" "${CSD_CONFIGURED_FILES_DIR}/S88.ui")
