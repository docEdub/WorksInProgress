#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: time_NoteTime.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_time_NoteTime_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_time_NoteTime_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}


opcode time_NoteTime, i, 0
    xout 0
endop

opcode time_NoteTime, k, 0
    ki init 0
    ki += 1
    xout ki / kr
endop


${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
