#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_PositionUdos_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_PositionUdos_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

//----------------------------------------------------------------------------------------------------------------------
// File: PositionUdos.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_CMAKE_POSITION_UDO_INCLUDES}

opcode dEd_position, iii, i
    iPositionOpcode xin
    iX = 0
    iY = 0
    iZ = 0
    ${CSOUND_CMAKE_POSITION_UDO_IPASS_SWITCH}
    ; log_i_debug("position = (%.03f, %.03f, %.03f)", iX, iY, iZ)
    xout iX, iY, iZ
endop

opcode dEd_position, kkk, k
    kPositionOpcode xin
    kX = 0
    kY = 0
    kZ = 0
    ${CSOUND_CMAKE_POSITION_UDO_KPASS_SWITCH}
    ; log_k_debug("position = (%.03f, %.03f, %.03f)", kX, kY, kZ)
    xout kX, kY, kZ
endop

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
