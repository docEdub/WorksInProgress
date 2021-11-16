
include("${CsoundCMake.Cabbage_DIR}/Source/global.cmake")

set(setting_width "300")
set(setting_height "25")
set(setting_dimensions "${setting_width}, ${setting_height}")

set(setting_width_x2 MATH "2 * ${setting_width}")
set(setting_height_x2 MATH "2 * ${setting_height}")
set(setting_height_x3 MATH "3 * ${setting_height}")

set(setting_label_x "0")
set(setting_label_y "5")
set(setting_label_width "190")
set(setting_label_height "16")

set(setting_input_x MATH "${setting_label_x} + ${setting_label_width} + 10")
set(setting_input_y "1")
set(setting_input_width "75")
set(setting_input_height "23")

set(setting_label "${label} bounds(${setting_label_x}, ${setting_label_y}, ${setting_label_width}, ${setting_label_height}) align(\"right\")")
set(setting_input "${nslider_dark} bounds(${setting_input_x}, ${setting_input_y}, ${setting_input_width}, ${setting_input_height})")
set(setting_combobox "${combobox_dark} align(\"right\")")
