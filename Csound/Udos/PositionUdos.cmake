
set(PositionUdosDir "${CMAKE_CURRENT_LIST_DIR}/PositionUdos")

file(GLOB PositionUdos "${PositionUdosDir}/*.orc")
message("PositionUdos == ${PositionUdos}")

foreach(positionUdoPath ${PositionUdos})
    get_filename_component(positionUdoName "${positionUdoPath}" NAME_WE)
    set(positionUdo "AF_${positionUdoName}")
    message("Path: ${positionUdoPath}")
    message("Name: ${positionUdoName}")
    message("UDO: ${positionUdo}")
    list(APPEND positionUdoNames ${positionUdoName})
endforeach()

string(REPLACE ";" "\",\"" CSOUND_CMAKE_POSITION_UDO_NAMES "\"${positionUdoNames}\"")
message("CSOUND_CMAKE_POSITION_UDO_NAMES: ${CSOUND_CMAKE_POSITION_UDO_NAMES}")
