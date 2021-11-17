
set(CSOUND_CMAKE_POSITION_UDO_DIR "${CMAKE_CURRENT_LIST_DIR}/PositionUdos")

set(positionUdoNames
    "RandomPosition1"
    "RandomPosition2"
    "RandomPosition3"
    "RandomPosition4"
    )

string(REPLACE ";" "\",\"" CSOUND_CMAKE_POSITION_UDO_NAMES "\"${positionUdoNames}\"")
