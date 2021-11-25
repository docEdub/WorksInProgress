#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_PositionUdos_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_PositionUdos_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

//----------------------------------------------------------------------------------------------------------------------
// File: PositionUdos.orc
//----------------------------------------------------------------------------------------------------------------------

#include "${CSOUND_CMAKE_POSITION_UDO_DIR}/randomPosition1.orc"
#include "${CSOUND_CMAKE_POSITION_UDO_DIR}/randomPosition2.orc"
#include "${CSOUND_CMAKE_POSITION_UDO_DIR}/randomPosition3.orc"
#include "${CSOUND_CMAKE_POSITION_UDO_DIR}/randomPosition4.orc"

opcode dEd_position, iii, 0
    SPositionOpcode = chnget("positionOpcode")
    iX = 0
    iY = 0
    iZ = 0
    if (strcmp(SPositionOpcode, "randomPosition1") == 0) then
        iX, iY, iZ dEd_randomPosition1
    elseif (strcmp(SPositionOpcode, "randomPosition2") == 0) then
        iX, iY, iZ dEd_randomPosition2
    elseif (strcmp(SPositionOpcode, "randomPosition3") == 0) then
        iX, iY, iZ dEd_randomPosition3
    elseif (strcmp(SPositionOpcode, "randomPosition4") == 0) then
        iX, iY, iZ dEd_randomPosition4
    endif
    xout iX, iY, iZ
endop

opcode dEd_position, kkk, 0
    SPositionOpcode = chngetks("positionOpcode")
    kX = 0
    kY = 0
    kZ = 0
    if (strcmpk(SPositionOpcode, "randomPosition1") == 0) then
        kX, kY, kZ dEd_randomPosition1
    elseif (strcmpk(SPositionOpcode, "randomPosition2") == 0) then
        kX, kY, kZ dEd_randomPosition2
    elseif (strcmpk(SPositionOpcode, "randomPosition3") == 0) then
        kX, kY, kZ dEd_randomPosition3
    elseif (strcmpk(SPositionOpcode, "randomPosition4") == 0) then
        kX, kY, kZ dEd_randomPosition4
    endif
    xout kX, kY, kZ
endop

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
