#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: log.orc
//----------------------------------------------------------------------------------------------------------------------

#if LOGGING

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_log_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_log_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_INCLUDE} "string.orc"
${CSOUND_INCLUDE} "time.orc"

// Logging to the DAW via OSC in a user-defined opcode doesn't work from instruments in their release stage, but it
// does work from an instrument triggered via the 'scoreline_i' or 'scoreline' Csound opcodes.
//
instr LogToDAW
    S_message init strget(p4)
    OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_LOG_MESSAGE_PATH, "s", S_message)
    turnoff
endin

opcode log_line_string, S, i
    i_line xin
    if (i_line < 10) then
        S_pad = "   "
    elseif (i_line < 100) then
        S_pad = "  "
    elseif (i_line < 1000) then
        S_pad = " "
    else
        S_pad = ""
    endif
    xout sprintf("(%d)%s", i_line, S_pad)
endop

#if LOG_TRACE
    ${CSOUND_DEFINE} log_level_trace_abbreviation   #"trc"#
    #define log_level trace
    #include "log.orc.h"
    #undef log_level
#endif

#if LOG_DEBUG
    ${CSOUND_DEFINE} log_level_debug_abbreviation   #"dbg"# 
    #define log_level debug
    #include "log.orc.h"
    #undef log_level
#endif

#if LOG_INFO
    ${CSOUND_DEFINE} log_level_info_abbreviation    #"inf"#
    #define log_level info
    #include "log.orc.h"
    #undef log_level
#endif

#if LOG_WARNING
    ${CSOUND_DEFINE} log_level_warning_abbreviation #"wrn"#
    #define log_level warning
    #include "log.orc.h"
    #undef log_level
#endif

#if LOG_ERROR
    ${CSOUND_DEFINE} log_level_error_abbreviation   #"err"#
    #define log_level error
    #include "log.orc.h"
    #undef log_level
#endif

#if LOG_FATAL
    ${CSOUND_DEFINE} log_level_fatal_abbreviation   #"fat"#
    #define log_level fatal
    #include "log.orc.h"
    #undef log_level
#endif

${CSOUND_INCLUDE_GUARD_ENDIF}

#endif // #if LOGGING

//----------------------------------------------------------------------------------------------------------------------
