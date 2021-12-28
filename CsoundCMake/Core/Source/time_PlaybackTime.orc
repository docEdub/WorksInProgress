#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: time_playback.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_time_playback_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_time_playback_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}


${CSOUND_IFDEF} IS_PLAYBACK
    gkTime_PlaybackStartKPass init 0

    instr time_UpdatePlaybackStartKPass
        if (changed2(gk_playing) == true && gk_playing == true) then
            gkTime_PlaybackStartKPass = gk_i
        endif
    endin

    alwayson "time_UpdatePlaybackStartKPass"

    opcode time_PlaybackTime, i, 0
        xout (i(gk_i - gkTime_PlaybackStartKPass) + 1) / giKR
    endop

    opcode time_PlaybackTime, k, 0
        xout (gk_i - gkTime_PlaybackStartKPass) / giKR
    endop
${CSOUND_ELSE}
    opcode time_PlaybackTime, i, 0
        xout i(gk_i)
    endop

    opcode time_PlaybackTime, k, 0
        xout gk_i
    endop
${CSOUND_ENDIF}

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
