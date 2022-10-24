#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Reverb.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef Reverb_orc__include_guard
#define Reverb_orc__include_guard
//----------------------------------------------------------------------------------------------------------------------
// This section is only included once in the playback .csd. It is shared by all instances of this instrument.
//----------------------------------------------------------------------------------------------------------------------

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    "enabled",           "bool",     "false",   "synced",   _(\)
    "size",              "number",   "0.5",     "synced",   _(\)
    "cutoffFrequency",   "number",   "20000",   "synced",   _(\)
    "variationDepth",    "number",   "0.1",     "synced",   _(\)
    "dryWet",            "number",   "1",       "synced",   _(\)
    "volume",            "number",   "0.5",     "synced",   _(\)
_(\)
    "",                  "",         "",        "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #28#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    CREATE_CC_INDEX(enabled)
    CREATE_CC_INDEX(size)
    CREATE_CC_INDEX(cutoffFrequency)
    CREATE_CC_INDEX(variationDepth)
    CREATE_CC_INDEX(dryWet)
    CREATE_CC_INDEX(volume)
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

//----------------------------------------------------------------------------------------------------------------------
#endif // #ifndef Reverb_orc__include_guard


instr INSTRUMENT_ID
    ${CSOUND_IFDEF} IS_GENERATING_JSON
        goto end
    ${CSOUND_ENDIF}
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
        aIn1 init 0
        aIn2 init 0
        aOut[] init 2

        #if IS_PLAYBACK
            if (INSTRUMENT_TRACK_INDEX < gi_instrumentCount) then
                aIn1 = chnget:a(STRINGIZE(INSTRUMENT_TRACK_INDEX/4))
                aIn2 = chnget:a(STRINGIZE(INSTRUMENT_TRACK_INDEX/5))
            else
                iAuxTrackIndex = INSTRUMENT_TRACK_INDEX - gi_instrumentCount
                aIn1 = ga_auxSignals[iAuxTrackIndex][4]
                aIn1 = ga_auxSignals[iAuxTrackIndex][5]
            endif
        #else
            aIn1 = inch(5)
            aIn2 = inch(6)
        #endif

        if (CC_VALUE_k(enabled) == true) then
            aOut[0], aOut[1] reverbsc aIn1, aIn2, CC_VALUE_k(size), CC_VALUE_k(cutoffFrequency), sr, 0.1
            kDryWet = CC_VALUE_k(dryWet)
            aOut[0] = aOut[0] * kDryWet
            aOut[1] = aOut[1] * kDryWet
            kWetDry = 1 - kDryWet
            aOut[0] = aOut[0] + aIn1 * kWetDry
            aOut[1] = aOut[1] + aIn2 * kWetDry
            kVolume = CC_VALUE_k(volume)
            aOut[0] = aOut[0] * kVolume
            aOut[1] = aOut[1] * kVolume
        else
            aOut[0] = aIn1
            aOut[1] = aIn2
        endif

        #if IS_PLAYBACK
            log_i_debug("Instrument count = %d", gi_instrumentCount)
        #endif

        kI = 0
        kJ = 4
        while (kI < 2) do
            #if IS_PLAYBACK
                iAuxTrackIndex = INSTRUMENT_TRACK_INDEX
                if (iAuxTrackIndex >= gi_instrumentCount) then
                    iAuxTrackIndex -= gi_instrumentCount
                endif
                ga_auxSignals[iAuxTrackIndex][kJ] = aOut[kI]
                kJ += 1
            #else
                kJ += 1
                outch(kJ, aOut[kI])
            #endif
            kI += 1
        od

        #if !IS_PLAYBACK
            if (gkReloaded == true) then
                // Note that we have to restart the instrument 2 k-cycles from now, otherwise it won't restart, maybe
                // due to some queuing order issue.
                event("i", p1, 2 / kr, -1, p4, p5, p6)
                turnoff
            endif
        #endif
    endif

end:
    log_i_trace("%s - done", SInstrument)
endin


#if IS_PLAYBACK
    instr CONCAT(Preallocate_, INSTRUMENT_ID)
        ii = 0
        while (ii < 4) do
            scoreline_i(sprintf("i %d.%.3d 0 .1 0 0 0", INSTRUMENT_ID, ii))
            ii += 1
        od
        turnoff
    endin
    scoreline_i(sprintf("i \"Preallocate_%d\" 0 -1", INSTRUMENT_ID))
#endif

//----------------------------------------------------------------------------------------------------------------------
