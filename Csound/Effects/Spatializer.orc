#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Spatializer.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"
#include "Position_defines.h"


#ifndef Spatializer_orc__include_guard
#define Spatializer_orc__include_guard
//----------------------------------------------------------------------------------------------------------------------
// This section is only included once in the playback .csd. It is shared by all instances of this instrument.
//----------------------------------------------------------------------------------------------------------------------

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    POSITION_CC_INFO
    "",                      "",           "",       "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #52#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    #include "Position_ccIndexes.orc"
    turnoff
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
${CSOUND_INCLUDE} "PositionUdos.orc"
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
        iCcIndex = p5
        iCcValue = p6
        if (strcmp(gSCcInfo[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
            gSCcValues[ORC_INSTANCE_INDEX][iCcIndex] = strget(iCcValue)
        else
            giCcValues[ORC_INSTANCE_INDEX][iCcIndex] = iCcValue
            gkCcValues[ORC_INSTANCE_INDEX][iCcIndex] = iCcValue
        endif
        turnoff
    elseif (iEventType == EVENT_EFFECT_ON) then
        aIn init 0

        #if IS_PLAYBACK
            if (INSTRUMENT_TRACK_INDEX < gi_instrumentCount) then
                aIn = chnget:a(STRINGIZE(MIX_ID/3))
            else
                iAuxTrackIndex = INSTRUMENT_TRACK_INDEX - gi_instrumentCount
                aIn = ga_auxSignals[iAuxTrackIndex][3]
            endif
        #else
            aIn = inch(4)
        #endif

        if (CC_VALUE_k(positionEnabled) == true) then
            #include "Position_kXYZ.orc"

            aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
            aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
            aOut = aIn * min(aDistanceAmp, a(kPositionMaxAmpWhenClose))

            AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
            a1 = gkAmbisonicChannelGains[0] * aOut
            a2 = gkAmbisonicChannelGains[1] * aOut
            a3 = gkAmbisonicChannelGains[2] * aOut
            a4 = gkAmbisonicChannelGains[3] * aOut
        else
            // Disabled.
            a1 = aIn
            a2 = 0
            a3 = 0
            a4 = 0
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
