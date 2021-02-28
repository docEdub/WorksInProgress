
include("${CsoundAuger_DIR}/CsoundAugerConfig.cmake")

# Set main Cabbage form width and height.
#
set(form_width 180)
set(form_height 240)

set(button_count 4)
set(button_width MATH "${form_width} - (2 * ${padding})")
set(button_height MATH "(${form_height} - (${button_count} * (${padding} + 1))) / ${button_count}")

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
set(mode_button "${button} colour:0(${dark_grey}) radiogroup(\"mode\")")
