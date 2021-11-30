
include("${CsoundCMake.Core_DIR}/Source/global.cmake")
set(PREPROCESSOR_INCLUDE_DIR ${CSOUND_CMAKE_CONFIGURED_FILES_DIR})

include("${CsoundCMake.Core_DIR}/Source/functions/add_preprocess_file_command.cmake")
include("${CsoundCMake.Core_DIR}/Source/functions/get_dependencies.cmake")

set(CSOUND_CMAKE_POSITION_UDO_DIR "${CMAKE_CURRENT_LIST_DIR}/PositionUdos")

set(positionUdoNames
    "<none>"
    "randomPosition1"
    "randomPosition2"
    "randomPosition3"
    "randomPosition4"
    "randomXZ_1"
    )

set(PositionUdos_dependencies )
foreach(positionUdo ${positionUdoNames})
    list(APPEND PositionUdos_dependencies "${CSOUND_CMAKE_POSITION_UDO_DIR}/${positionUdo}.orc")
endforeach()

configure_file("${CMAKE_CURRENT_LIST_DIR}/PositionUdos.orc" "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/PositionUdos.orc")

get_dependencies(PositionUdos_dependencies "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/PositionUdos.orc")
add_preprocess_file_command(
    "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/PositionUdos.orc"
    "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/PositionUdos.orc"
    DEPENDS ${PositionUdos_dependencies}
)

list(APPEND csd_target_dependencies "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/PositionUdos.orc")

string(REPLACE ";" "\",\"" CSOUND_CMAKE_POSITION_UDO_NAMES "\"${positionUdoNames}\"")
