#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: time.orc
//
// N.B. The opcodes in log.orc are not available in this file because log.orc includes it.
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_time_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_time_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

// The Csound 'times' opcode does not work as expected when called from a user defined opcode. This opcode uses the
// global k cycle counter to calculate the time. Note that at i time the global cycle counter hasn't been incremented,
// yet, so this opcode returns the time at the next global k cycle.
opcode time_i, i, 0
    xout (i(gk_i) + 1) / giKR
endop

opcode time_k, k, 0
    xout gk_i / giKR
endop

opcode time_string_i, S, 0
    i_time = time_i()
    i_hours = floor(i_time / 3600)
    i_ = i_time - (3600 * i_hours)
    i_minutes = floor(i_ / 60)
    i_seconds = floor(i_ - (60 * i_minutes))
    i_nanoseconds = 10000 * frac(i_time)
    xout sprintf("%d:%02d:%02d.%04d", i_hours, i_minutes, i_seconds, i_nanoseconds)
endop

opcode time_string_k, S, 0
    k_time = time_k()
    k_hours = floor(k_time / 3600)
    k_ = k_time - (3600 * k_hours)
    k_minutes = floor(k_ / 60)
    k_seconds = floor(k_ - (60 * k_minutes))
    k_nanoseconds = 10000 * frac(k_time)
    xout sprintfk("%d:%02d:%02d.%04d", k_hours, k_minutes, k_seconds, k_nanoseconds)
endop

opcode time_metro, k, i
    i_cps xin
    k_returnValue init 0

    i_secondsPerTick = 1 / i_cps
    i_startTime = time_i()
    k_nextTickTime init i_startTime
    k_currentTime = time_k()
    if (k_nextTickTime < k_currentTime) then
        k_returnValue = true
        k_nextTickTime += i_secondsPerTick
    else
        k_returnValue = false
    endif
    
    xout k_returnValue
endop

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
