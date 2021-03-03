
set(form_width 960)
set(form_height 640)

set(InstrumentName "TestMasterHead")

get_filename_component(CSOUND_CMAKE_OUTPUT_SUBDIRECTORY "${CMAKE_CURRENT_LIST_FILE}" NAME_WE)
include("${CsoundCMake.Cabbage_DIR}/Source/ui/TrackInfo.cmake")

set(csoundoutput_group_y MATH "${TrackInfo_height} + ${padding}")
set(csoundoutput_group_height MATH "${form_height} - ${csoundoutput_group_y}")
set(csoundoutput_group_rect "0, ${csoundoutput_group_y}, ${form_width}, ${csoundoutput_group_height}")
