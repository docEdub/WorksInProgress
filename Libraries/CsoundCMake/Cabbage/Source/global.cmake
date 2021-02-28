
include("${CsoundAuger_DIR}/CsoundAugerConfig.cmake")

# Set form_width and form_height CMake variables before including this file.
if(NOT DEFINED form_width OR NOT DEFINED form_height)
    message(FATAL_ERROR "CMake form_width and form_height variables are not set.")
endif()

# Abbreviations
set(form_size "${form_width}, ${form_height}")
