#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Spatializer.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef Spatializer_orc__include_guard
#define Spatializer_orc__include_guard
//----------------------------------------------------------------------------------------------------------------------
// This section is only included once in the playback .csd. It is shared by all instances of this instrument.
//----------------------------------------------------------------------------------------------------------------------

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    "enabled",   "bool",       "true",  "synced",   _(\)
_(\)
    "x",         "number",     "0",     "synced",   _(\)
    "y",         "number",     "0",     "synced",   _(\)
    "z",         "number",     "0",     "synced",   _(\)
_(\)
    "x_scale",   "number",     "1",     "synced",   _(\)
    "y_scale",   "number",     "1",     "synced",   _(\)
    "z_scale",   "number",     "1",     "synced",   _(\)
_(\)
    "",          "",           "",      "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #32#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    CREATE_CC_INDEX(enabled)
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

${CSOUND_INCLUDE} "time.orc"

//----------------------------------------------------------------------------------------------------------------------
#endif // #ifndef Spatializer_orc__include_guard


instr INSTRUMENT_ID
    #if LOGGING
        #ifdef INSTRUMENT_ID_DEFINED
            SInstrument = sprintf("%.3f", p1)
        #else
            SInstrument = sprintf("%s.%03d", nstrstr(p1), 1000 * frac(p1))
        #endif
        log_i_trace("%s ...", SInstrument)
    #endif

    log_i_debug("p1 = %f", p1)
    log_i_debug("track index = %d", INSTRUMENT_TRACK_INDEX)

    iOrcInstanceIndex = ORC_INSTANCE_INDEX

    // Don't modify the signal in DAW service modes 2, 3, and 4. It will mess up the track index and CC score messages.
    #if !IS_PLAYBACK
        if (gk_mode != 1) kgoto end
    #endif

    iEventType = p4
    if (iEventType == EVENT_CC) then
        iCcType = p5
        iCcValue = p6
        giCcValues[ORC_INSTANCE_INDEX][iCcType] = iCcValue
        gkCcValues[ORC_INSTANCE_INDEX][iCcType] = iCcValue
        turnoff
    elseif (iEventType == EVENT_EFFECT_ON) then
        aIn init 0
        aOut[] init 6

        kPlaybackTime = chnget:k("TIME_IN_SECONDS")

        ; #if LOGGING
        ;     kLastPrintTime init 0
        ;     kTime = time_k()
        ;     if (kTime - kLastPrintTime > 1) then
        ;         log_k_debug("kPlaybackTime = %f", kPlaybackTime)
        ;         kLastPrintTime = kTime
        ;     endif
        ; #endif

        #if !IS_PLAYBACK
            if (gkReloaded == true) then
                // Note that we have to restart the instrument 2 k-cycles from now, otherwise it won't restart, maybe
                // due to some queuing order issue.
                event("i", p1, 2 / kr, -1, p4, p5, p6)
                turnoff
            endif
        #endif
    endif

#if !IS_PLAYBACK
end:
#endif
    log_i_trace("%s - done", SInstrument)
endin

//----------------------------------------------------------------------------------------------------------------------
