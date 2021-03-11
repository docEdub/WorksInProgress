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
    log_i_debug("p1 = %f", p1)
    log_i_debug("track index = %d", INSTRUMENT_TRACK_INDEX)

    #if LOGGING
        #ifdef INSTRUMENT_ID_DEFINED
            SInstrument = sprintf("%.3f", p1)
        #else
            SInstrument = sprintf("%s.%03d", nstrstr(p1), 1000 * frac(p1))
        #endif
        log_i_info("%s ...", SInstrument)
    #endif

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
        aIn[] init 2
        aOut[] init 2

        kI = 0
        kJ = 4
        while (kI < 2) do
            #if IS_PLAYBACK
                if (INSTRUMENT_TRACK_INDEX < gi_instrumentCount) then
                    aIn[kI] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][kJ]
                else
                    iAuxTrackIndex = INSTRUMENT_TRACK_INDEX - gi_instrumentCount
                    aIn[kI] = ga_auxSignals[iAuxTrackIndex][kJ]
                endif
                kJ += 1
            #else
                kJ += 1
                aIn[kI] = inch(kJ)
            #endif
            kI += 1
        od

        if (CC_VALUE_k(enabled) == true) then
            aOut[0], aOut[1] reverbsc aIn[0], aIn[1], CC_VALUE_k(size), CC_VALUE_k(cutoffFrequency), sr, 0.1
            kDryWet = CC_VALUE_k(dryWet)
            aOut[0] = aOut[0] * kDryWet
            aOut[1] = aOut[1] * kDryWet
            kWetDry = 1 - kDryWet
            aOut[0] = aOut[0] + aIn[0] * kWetDry
            aOut[1] = aOut[1] + aIn[1] * kWetDry
            kVolume = CC_VALUE_k(volume)
            aOut[0] = aOut[0] * kVolume
            aOut[1] = aOut[1] * kVolume
        else
            aOut[0] = aIn[0]
            aOut[1] = aIn[1]
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
    endif

#if !IS_PLAYBACK
end:
#endif
    log_i_info("%s - done", SInstrument)
endin

//----------------------------------------------------------------------------------------------------------------------
