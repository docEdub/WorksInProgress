#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Triangle1Synth.orc
//
// Description:
//  Single triangle wave oscillator with piano-like decay.
//----------------------------------------------------------------------------------------------------------------------

#include "synth-before-include-guard.h.orc"

#ifndef ${InstrumentName}_orc__include_guard
#define ${InstrumentName}_orc__include_guard

#include "synth-inside-include-guard.h.orc"

giTriangle1Synth_PlaybackVolumeAdjustment = 0.9
giTriangle1Synth_PlaybackReverbAdjustment = 1.5

giTriangle1Synth_NoteIndex[] init ORC_INSTANCE_COUNT

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    gSPluginUuids[INSTRUMENT_TRACK_INDEX][INSTRUMENT_PLUGIN_INDEX] = INSTRUMENT_PLUGIN_UUID

    instr CONCAT(Json_, INSTRUMENT_ID)
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

            aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
            aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
            aOut *= min(aDistanceAmp, a(kPositionMaxAmpWhenClose))

            AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
            a1 = a(gkAmbisonicChannelGains[0]) * aOut
            a2 = a(gkAmbisonicChannelGains[1]) * aOut
            a3 = a(gkAmbisonicChannelGains[2]) * aOut
            a4 = a(gkAmbisonicChannelGains[3]) * aOut
        else
            // Disabled.
            a1 = aOut
            a2 = 0
            a3 = 0
            a4 = 0
        endif

        #if IS_PLAYBACK
            chnset(a1, STRINGIZE(MIX_ID/0))
            chnset(a2, STRINGIZE(MIX_ID/1))
            chnset(a3, STRINGIZE(MIX_ID/2))
            chnset(a4, STRINGIZE(MIX_ID/3))
            chnset(aOut, STRINGIZE(MIX_ID/4))
            chnset(aOut, STRINGIZE(MIX_ID/5))
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
                scoreline_i(sprintf("i \"%s\" 0 0", STRINGIZE(CONCAT(Json_, INSTRUMENT_ID))))
            endif
            giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX] = giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"note\":{\"onTime\":%.3f}}", times())
            ficlose(SJsonFile)
        ${CSOUND_ENDIF}
    endif
end:
endin

#if IS_PLAYBACK
    instr CONCAT(Preallocate_, INSTRUMENT_ID)
        ii = 0
        while (ii < giPresetUuidPreallocationCount[INSTRUMENT_TRACK_INDEX]) do
            scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", INSTRUMENT_ID, ii, EVENT_NOTE_GENERATED))
            ii += 1
        od
        turnoff
    endin
    scoreline_i(sprintf("i \"Preallocate_%d\" 0 -1", INSTRUMENT_ID))
#endif

#include "synth.instr.h.orc"

//----------------------------------------------------------------------------------------------------------------------
