#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: time_PlaybackTime.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_time_PlaybackTime_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_time_PlaybackTime_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}


${CSOUND_IFDEF} IS_PLAYBACK
    opcode time_PlaybackTime, i, 0
        xout i(gk_i) / giKR
    endop

    opcode time_PlaybackTime, k, 0
        xout gk_i / giKR
    endop
${CSOUND_ELSE}
    opcode time_PlaybackTime, i, 0
        xout time_i() - i(gk_dawPlayStartTime)
    endop

    opcode time_PlaybackTime, k, 0
        xout time_k() - gk_dawPlayStartTime
    endop
${CSOUND_ENDIF}


${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
