
set(form_width 960)
set(form_height 516)

set(InstrumentName "BusHead")

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
set(CSD_SOURCE_FILE_PATH "${CSD_SOURCE_DIR}/${InstrumentName}.csd")
get_generated_csd_dirs(CSD_CONFIGURED_FILES_DIR CSD_PREPROCESSED_FILES_DIR "${CSD_SOURCE_FILE_PATH}")

include("${CsoundCMake.Cabbage_DIR}/Source/ui/TrackInfo.cmake")

set(csoundoutput_group_y MATH "${TrackInfo_height} + ${padding}")
set(csoundoutput_group_height MATH "${form_height} - ${csoundoutput_group_y}")
set(csoundoutput_group_rect "0, ${csoundoutput_group_y}, ${form_width}, ${csoundoutput_group_height}")
