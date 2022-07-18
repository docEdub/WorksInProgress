#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Triangle2Synth.orc
//
// Description:
//  Single triangle wave oscillator with piano-like decay and 2 note number LFOs.
//----------------------------------------------------------------------------------------------------------------------

#include "synth-before-include-guard.h.orc"

#ifndef ${InstrumentName}_orc__include_guard
#define ${InstrumentName}_orc__include_guard

#include "synth-inside-include-guard.h.orc"

${CSOUND_INCLUDE} "json.orc"

giTriangle2Synth_PlaybackVolumeAdjustment = 0.9
giTriangle2Synth_PlaybackReverbAdjustment = 1.5
giTriangle2Synth_NoteNumberLfoAmp = 0.333

giTriangle2Synth_NoteIndex[] init ORC_INSTANCE_COUNT

giTriangle2Synth_LfoShapeTable = ftgen(0, 0, 60, GEN07, 0, 15, 1, 30, -1, 15, 0)

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr CONCAT(Json_, INSTRUMENT_ID)
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, sprintf(",\"pitchLfoAmp\":%.3f", giTriangle2Synth_NoteNumberLfoAmp))

        fprints(SJsonFile, ",\"pitchLfoShape\":[")
        iLfoShapeTableIndex = 0
        while (iLfoShapeTableIndex < 60) do
            if (iLfoShapeTableIndex > 0) then
                fprints(SJsonFile, ",")
            endif
            fprints(SJsonFile, sprintf("%.3f", tab_i(iLfoShapeTableIndex, giTriangle2Synth_LfoShapeTable)))
            iLfoShapeTableIndex += 1
        od
        fprints(SJsonFile, "]}")
        turnoff
    endin
${CSOUND_ENDIF}


gkNoteNumberLfo init 0

instr CONCAT(GlobalNoteNumberLfo_, INSTRUMENT_ID)
    log_i_trace("%s ...", nstrstr(p1))

    gkNoteNumberLfo = abs(lfo(33, .03, LFO_SHAPE_TRIANGLE))

    #if !IS_PLAYBACK
        if (gkReloaded == true) then
            event("i", STRINGIZE(CONCAT(GlobalNoteNumberLfo_, INSTRUMENT_ID)), 0, -1)
            turnoff
        endif
    #endif

    ; #if LOGGING
    ;     kLastTime init 0
    ;     kTime = time_k()
    ;     if (kTime - kLastTime > 1) then
    ;         kLastTime = kTime
    ;         log_k_trace("%s running ...", nstrstr(p1))
    ;     endif
    ; #endif

    log_i_trace("%s - done", nstrstr(p1))
endin

event_i("i", STRINGIZE(CONCAT(GlobalNoteNumberLfo_, INSTRUMENT_ID)), 0, -1)


instr INSTRUMENT_ID
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
        iNoteNumber = p5
        iVelocity = p6

        iNoteNumberLfoTime = i(gkNoteNumberLfo)
        iOrcInstanceIndex = ORC_INSTANCE_INDEX
        aOut = 0
        a1 = 0
        a2 = 0
        a3 = 0
        a4 = 0

        // Oscillator
        //--------------------------------------------------------------------------------------------------------------
        kAmp init 0.333 * (iVelocity / 127)
        kNoteNumber = iNoteNumber + lfo(giTriangle2Synth_NoteNumberLfoAmp, iNoteNumberLfoTime, LFO_SHAPE_TRIANGLE)
        aOut = vco2(kAmp, cpsmidinn(kNoteNumber), VCO2_WAVEFORM_TRIANGLE_NO_RAMP)

        // Volume envelope
        //--------------------------------------------------------------------------------------------------------------
        iEnvelopeA = 0.01
        iEnvelopeD = 0.1
        iEnvelopeS = 0.667
        iEnvelopeR = 0.1

        iEnvelopeS_decayTime = 0.333 + 33 * (1 - iNoteNumber / 127)
        iEnvelopeS_decayAmountMinimum = 0.001 * (1 - iNoteNumber / 127)

        aOut *= MIDIFY_OPCODE(xadsr):a(iEnvelopeA, iEnvelopeD, iEnvelopeS, iEnvelopeR)

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

        if (CC_VALUE_k(positionEnabled) == true) then
            #include "Position_kXYZ.orc"

            aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
            aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
            aOut *= min(aDistanceAmp, a(kPositionMaxAmpWhenClose))

            AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
            a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aOut
            a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aOut
            a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aOut
            a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aOut
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
            if (giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i(sprintf("i \"%s\" 0 0", STRINGIZE(CONCAT(Json_, INSTRUMENT_ID))))
            endif
            giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX] = giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX])
            iOnTime = times()
            SJsonData = sprintf("{\"note\":{\"onTime\":%.3f,\"pitch\":%.3f,\"pitchLfoTime\":%.3f",
                iOnTime, iNoteNumber, iNoteNumberLfoTime)
            if (lastcycle() == true) then
                // Only print the position xyz for the first note since all other notes are in the same position.
                fprintks(SJsonFile, SJsonData)
                if (CC_VALUE_k(positionEnabled) == true && giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX] == 1) then
                    fprintks(SJsonFile, ",\"xyz\":[%.3f,%.3f,%.3f]", kX, kY, kZ)
                endif
                fprintks(SJsonFile, ",\"offTime\":%.3f}}", timeinsts() + iOnTime)
            endif
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
