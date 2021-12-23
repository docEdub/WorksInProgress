#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Triangle1Synth.orc
//
// Description:
//  Single triangle wave oscillator with piano-like decay.
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"
#include "Position_defines.h"


#ifndef Triangle1Synth_orc__include_guard
#define Triangle1Synth_orc__include_guard

${CSOUND_INCLUDE} "adsr_linsegr.udo.orc"

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    POSITION_CC_INFO
_(\)
    "",                                         "",         "",                 "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #52#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    #include "Position_ccIndexes.orc"
    turnoff
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
${CSOUND_INCLUDE} "math.orc"
${CSOUND_INCLUDE} "PositionUdos.orc"
${CSOUND_INCLUDE} "time.orc"

giTriangle1Synth_PlaybackVolumeAdjustment = 0.9
giTriangle1Synth_PlaybackReverbAdjustment = 1.5

giTriangle1Synth_NoteIndex[] init ORC_INSTANCE_COUNT

#endif // #ifndef Triangle1Synth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr Triangle1Synth_Json
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, "}")
        turnoff
    endin
${CSOUND_ENDIF}


instr INSTRUMENT_ID
    iOrcInstanceIndex = ORC_INSTANCE_INDEX
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
    elseif (iEventType == EVENT_NOTE_ON) then

        // Oscillator
        //--------------------------------------------------------------------------------------------------------------
        iNoteNumber = p5
        iVelocity = p6
        iCps = cpsmidinn(iNoteNumber)
        kAmp = 0.333 * (iVelocity / 127)

        aOut = vco2(kAmp, iCps, VCO2_WAVEFORM_TRIANGLE_NO_RAMP)

        // Volume envelope
        //--------------------------------------------------------------------------------------------------------------
        iEnvelopeA = 0.005
        iEnvelopeD = 0.1
        iEnvelopeS = 0.667
        iEnvelopeR = 0.1

        iEnvelopeS_decayTime = 0.333 + 33 * (1 - iNoteNumber / 127)
        iEnvelopeS_decayAmountMinimum = 0.001 * (1 - iNoteNumber / 127)

        #if IS_PLAYBACK
            aOut *= xadsr:a(iEnvelopeA, iEnvelopeD, iEnvelopeS, iEnvelopeR)
        #else
            aOut *= mxadsr:a(iEnvelopeA, iEnvelopeD, iEnvelopeS, iEnvelopeR)
        #endif

        iEnvelopeS_decayStartTime = p2 + iEnvelopeA + iEnvelopeD
        iEnvelopeS_decayEndTime = iEnvelopeS_decayStartTime + iEnvelopeS_decayTime
        aEnvelopeS_decayAmount init 1
        kTime = time_k()
        if (kTime >= iEnvelopeS_decayStartTime && kTime < iEnvelopeS_decayEndTime) then
            aEnvelopeS_decayAmount = expon(1, iEnvelopeS_decayTime, iEnvelopeS_decayAmountMinimum)
        endif
        aOut *= aEnvelopeS_decayAmount

        // Low pass filter
        //--------------------------------------------------------------------------------------------------------------
        aOut = tone(aOut, 999 + 333)

        if (CC_VALUE_i(positionEnabled) == true) then
            ; log_i_trace("Calling position UDO ...")
            #include "Position_kXYZ.orc"

            kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
            kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance,
                kPositionRolloffFactor)
            aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)

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
            a4 = aOut
        endif

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = a2
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = a3
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = a4
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = aOut
        #else
            kReloaded init false
            kFadeTimeLeft init 0.1
            if (gkReloaded == true) then
                log_k_debug("Turning off instrument %.04f due to reload.", p1)
                kReloaded = gkReloaded
            endif
            if (kReloaded == true) then
                kFadeTimeLeft -= 1 / kr
                if (kFadeTimeLeft <= 0) then
                    turnoff
                endif
            endif
            outc(a1, a2, a3, a4, aOut, aOut)
        #endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"Triangle1Synth_Json\" 0 0")
            endif
            giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX] = giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f}}", times())
            ficlose(SJsonFile)
        ${CSOUND_ENDIF}
    endif
end:
endin

//----------------------------------------------------------------------------------------------------------------------
