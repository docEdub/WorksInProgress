
get_filename_component(ROOT_DIR "${CMAKE_CURRENT_LIST_DIR}/.." REALPATH BASE_DIR "${CMAKE_CURRENT_LIST_DIR}")

include("${ROOT_DIR}/Libraries/CsoundCMake/CsoundCMake.cmake")
