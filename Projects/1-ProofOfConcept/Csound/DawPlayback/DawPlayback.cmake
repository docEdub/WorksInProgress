
include("${CsoundCMake.Cabbage_DIR}/CsoundCMake.CabbageConfig.cmake")

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
set(CSD_SOURCE_FILE_PATH "${CSD_SOURCE_DIR}/DawPlayback.csd")
get_generated_csd_dirs(CSD_CONFIGURED_FILES_DIR CSD_PREPROCESSED_FILES_DIR "${CSD_SOURCE_FILE_PATH}")
