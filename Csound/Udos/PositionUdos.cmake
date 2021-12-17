
include("${CsoundCMake.Core_DIR}/Source/global.cmake")
set(PREPROCESSOR_INCLUDE_DIR ${CSOUND_CMAKE_CONFIGURED_FILES_DIR})

include("${CsoundCMake.Core_DIR}/Source/functions/add_preprocess_file_command.cmake")
include("${CsoundCMake.Core_DIR}/Source/functions/get_dependencies.cmake")

set(CSOUND_CMAKE_POSITION_UDO_DIR "${CMAKE_CURRENT_LIST_DIR}/PositionUdos")

set(positionUdoNames
    "<none>"
    "circleXZ_1"
    "randomXZ_1"
    )

string(REPLACE ";" "\",\"" CSOUND_CMAKE_POSITION_UDO_NAMES "\"${positionUdoNames}\"")

set(PositionUdos_includes)
foreach(positionUdo ${positionUdoNames})
    list(APPEND PositionUdos_includes "#include \"${CSOUND_CMAKE_POSITION_UDO_DIR}/${positionUdo}.orc\"")
endforeach()
string(REPLACE ";" "\n" CSOUND_CMAKE_POSITION_UDO_INCLUDES "${PositionUdos_includes}")

set(PositionUdos_iPassSwitch "if (iPositionOpcode == 1) then\n        // <none>\n")
list(LENGTH positionUdoNames positionUdoNamesLength)
math(EXPR positionUdoNamesLastIndex "${positionUdoNamesLength} - 1")
foreach(positionUdoIndex RANGE 1 ${positionUdoNamesLastIndex})
    math(EXPR positionUdoCabbageIndex "${positionUdoIndex} + 1")
    list(GET positionUdoNames ${positionUdoIndex} positionUdo)
    set(PositionUdos_iPassSwitch
        "${PositionUdos_iPassSwitch}    elseif (iPositionOpcode == ${positionUdoCabbageIndex}) then\n")
    set(PositionUdos_iPassSwitch
        "${PositionUdos_iPassSwitch}        iX, iY, iZ dEd_${positionUdo}\n")
endforeach()
set(CSOUND_CMAKE_POSITION_UDO_IPASS_SWITCH "${PositionUdos_iPassSwitch}    endif")

set(PositionUdos_kPassSwitch "if (kPositionOpcode == 1) then\n        // <none>\n")
list(LENGTH positionUdoNames positionUdoNamesLength)
math(EXPR positionUdoNamesLastIndex "${positionUdoNamesLength} - 1")
foreach(positionUdoIndex RANGE 1 ${positionUdoNamesLastIndex})
    math(EXPR positionUdoCabbageIndex "${positionUdoIndex} + 1")
    list(GET positionUdoNames ${positionUdoIndex} positionUdo)
    set(PositionUdos_kPassSwitch
        "${PositionUdos_kPassSwitch}    elseif (kPositionOpcode == ${positionUdoCabbageIndex}) then\n")
    set(PositionUdos_kPassSwitch
        "${PositionUdos_kPassSwitch}        kX, kY, kZ dEd_${positionUdo}\n")
endforeach()
set(CSOUND_CMAKE_POSITION_UDO_KPASS_SWITCH "${PositionUdos_kPassSwitch}    endif")

configure_file("${CMAKE_CURRENT_LIST_DIR}/PositionUdos.orc" "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/PositionUdos.orc")

set(PositionUdos_dependencies)
get_dependencies(PositionUdos_dependencies "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/PositionUdos.orc")
foreach(positionUdo ${positionUdoNames})
    list(APPEND PositionUdos_dependencies "${CSOUND_CMAKE_POSITION_UDO_DIR}/${positionUdo}.orc")
endforeach()
add_preprocess_file_command(
    "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/PositionUdos.orc"
    "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/PositionUdos.orc"
    DEPENDS ${PositionUdos_dependencies}
)

list(APPEND csd_target_dependencies "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/PositionUdos.orc")
