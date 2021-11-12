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
    "enabled",              "bool",       "true",    "synced",   _(\)
    "maxAmpWhenClose",      "number",     "1",       "synced",   _(\)
    "referenceDistance",    "number",     "0.1",     "synced",   _(\)
    "rolloffFactor",        "number",     "0.01",    "synced",   _(\)
    "x",                    "number",     "0",       "synced",   _(\)
    "y",                    "number",     "0",       "synced",   _(\)
    "z",                    "number",     "0",       "synced",   _(\)
    "xScale",               "number",     "100",     "synced",   _(\)
    "yScale",               "number",     "100",     "synced",   _(\)
    "zScale",               "number",     "100",     "synced",   _(\)
    "",                      "",           "",       "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #44#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    CREATE_CC_INDEX(enabled)
    CREATE_CC_INDEX(maxAmpWhenClose)
    CREATE_CC_INDEX(referenceDistance)
    CREATE_CC_INDEX(rolloffFactor)
    CREATE_CC_INDEX(x)
    CREATE_CC_INDEX(y)
    CREATE_CC_INDEX(z)
    CREATE_CC_INDEX(xScale)
    CREATE_CC_INDEX(yScale)
    CREATE_CC_INDEX(zScale)
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
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

        #if IS_PLAYBACK
            if (INSTRUMENT_TRACK_INDEX < gi_instrumentCount) then
                aIn = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3]
            else
                iAuxTrackIndex = INSTRUMENT_TRACK_INDEX - gi_instrumentCount
                aIn = ga_auxSignals[iAuxTrackIndex][3]
            endif
        #else
            aIn = inch(4)
        #endif

        if (CC_VALUE_k(enabled) == true) then
            iPortTime = 50 / kr

            kMaxAmpWhenClose = portk(CC_VALUE_k(maxAmpWhenClose), iPortTime)
            kReferenceDistance = portk(CC_VALUE_k(referenceDistance), iPortTime)
            kRolloffFactor = portk(CC_VALUE_k(rolloffFactor), iPortTime)
            kX = portk(CC_VALUE_k(x) * CC_VALUE_k(xScale), iPortTime)
            kY = portk(CC_VALUE_k(y) * CC_VALUE_k(yScale), iPortTime)
            kZ = portk(CC_VALUE_k(z) * CC_VALUE_k(zScale), iPortTime)

            kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
            kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kReferenceDistance, kRolloffFactor)
            aOut = aIn * min(kDistanceAmp, kMaxAmpWhenClose)

            AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
            a1 = gkAmbisonicChannelGains[0] * aOut
            a2 = gkAmbisonicChannelGains[1] * aOut
            a3 = gkAmbisonicChannelGains[2] * aOut
            a4 = gkAmbisonicChannelGains[3] * aOut
        else
            // Disabled.
            a1 = 0
            a2 = 0
            a3 = 0
            a4 = aIn
            aOut = aIn
        endif

        #if IS_PLAYBACK
            iAuxTrackIndex = INSTRUMENT_TRACK_INDEX
            if (iAuxTrackIndex >= gi_instrumentCount) then
                iAuxTrackIndex -= gi_instrumentCount
            endif
            ga_auxSignals[iAuxTrackIndex][0] = a1
            ga_auxSignals[iAuxTrackIndex][1] = a2
            ga_auxSignals[iAuxTrackIndex][2] = a3
            ga_auxSignals[iAuxTrackIndex][3] = a4
            ga_auxSignals[iAuxTrackIndex][4] = aOut
            ga_auxSignals[iAuxTrackIndex][5] = aOut
        #else
            outc(a1, a2, a3, a4, aOut, aOut)
        #endif

        kPlaybackTime = chnget:k("TIME_IN_SECONDS")

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

//----------------------------------------------------------------------------------------------------------------------
