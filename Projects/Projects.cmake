
get_filename_component(PROJECT_DIR "${CMAKE_SOURCE_DIR}/.." ABSOLUTE)
get_filename_component(PROJECT_NAME "${PROJECT_DIR}" NAME)

get_filename_component(ROOT_DIR "${CMAKE_CURRENT_LIST_DIR}/.." ABSOLUTE)

include("${ROOT_DIR}/Libraries/CsoundCMake/CsoundCMake.cmake")
find_package(CsoundCMake.Cabbage REQUIRED)
