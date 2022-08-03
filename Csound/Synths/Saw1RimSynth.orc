#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Saw1RimSynth.orc
//
// Description:
//  Single saw wave oscillator with piano-like decay.
//----------------------------------------------------------------------------------------------------------------------

#include "synth-before-include-guard.h.orc"

#ifndef ${InstrumentName}_orc__include_guard
#define ${InstrumentName}_orc__include_guard

#include "synth-inside-include-guard.h.orc"

${CSOUND_INCLUDE} "json.orc"

gi${InstrumentName}_PlaybackVolumeAdjustment = 0.9
gi${InstrumentName}_PlaybackReverbAdjustment = 1.5
gi${InstrumentName}_NoteNumber1 = 89 // F
gi${InstrumentName}_NoteNumber2 = 91 // G
gi${InstrumentName}_NoteNumber3 = 93 // A
gi${InstrumentName}_RimPositionCount = 20
gi${InstrumentName}_RimPositionOffset = 0

gi${InstrumentName}_NoteIndex[] init ORC_INSTANCE_COUNT

#include "Common/RimMesh.orc"

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    gSPluginUuids[INSTRUMENT_TRACK_INDEX][INSTRUMENT_PLUGIN_INDEX] = INSTRUMENT_PLUGIN_UUID

    instr CONCAT(Json_, INSTRUMENT_ID)
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        iPositionIndexOffset = (gi${InstrumentName}_MeshSegmentCount / 2) / gi${InstrumentName}_RimPositionCount
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, sprintf(",\"positionCount\":%d", gi${InstrumentName}_RimPositionCount))
        fprints(SJsonFile, sprintf(",\"positionIndexOffset\":%d", iPositionIndexOffset))
        fprints(SJsonFile, "}")
        turnoff
    endin
${CSOUND_ENDIF}


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

        iOrcInstanceIndex = ORC_INSTANCE_INDEX
        aOut = 0
        a1 = 0
        a2 = 0
        a3 = 0
        a4 = 0

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (giSaw1RimSynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i(sprintf("i \"%s\" 0 0", STRINGIZE(CONCAT(Json_, INSTRUMENT_ID))))
            endif
            giSaw1RimSynth_NoteIndex[ORC_INSTANCE_INDEX] = giSaw1RimSynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giSaw1RimSynth_NoteIndex[ORC_INSTANCE_INDEX])
            iOnTime = times()
            fprints(SJsonFile, "{\"note\":{\"onTime\":%.3f,\"pitch\":%.3f", iOnTime, iNoteNumber)
        ${CSOUND_ENDIF}

        // Oscillator
        //--------------------------------------------------------------------------------------------------------------
        kAmp init 0.333 * (iVelocity / 127)
        aOut = vco2(kAmp, cpsmidinn(iNoteNumber), VCO2_WAVEFORM_INTEGRATED_SAWTOOTH)

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

        if (CC_VALUE_k(positionEnabled) == true) then
            #include "Position_kXYZ.orc"

            a1 = 0
            a2 = 0
            a3 = 0
            a4 = 0

            iMeshRow = 0
            if (iNoteNumber == gi${InstrumentName}_NoteNumber2) then
                iMeshRow = 1
            elseif (iNoteNumber == gi${InstrumentName}_NoteNumber3) then
                iMeshRow = 2
            endif
            log_i_debug("iNoteNumber = %d, iMeshRow = %d", iNoteNumber, iMeshRow)

            iMeshSegmentCountD2 = gi${InstrumentName}_MeshSegmentCount / 2
            iRimIndexCount = lenarray(gi${InstrumentName}_MeshAudioPositions) / 3
            iIndex = (((iMeshRow * iMeshSegmentCountD2) % iRimIndexCount) * 3) + 1
            iY = gi${InstrumentName}_MeshAudioPositions[iIndex]
            kY = iY

            iRimPositionIndexOffset = iMeshSegmentCountD2 / gi${InstrumentName}_RimPositionCount
            kRimPositionIndex = 0
            kRimPositionIndexWithOffset = 0
            kPrinted init false
            ; while (kRimPositionIndex < gi${InstrumentName}_RimPositionCount) do
            ;     kIndex = \
            ;         kRimPositionIndexWithOffset \
            ;         + gi${InstrumentName}_RimPositionOffset \
            ;         + (iMeshRow * iMeshSegmentCountD2)
            ;     kIndex = kIndex % iRimIndexCount
            ;     kIndex *= 3
            ;     kX = gi${InstrumentName}_MeshAudioPositions[kIndex]
            ;     kZ = gi${InstrumentName}_MeshAudioPositions[kIndex + 2]

            ;     if (kPrinted == false) then
            ;         log_k_debug("Position[%d] = [%.3f, %.3f, %.3f]", kRimPositionIndex, kX, kY, kZ)
            ;     endif

                kX = 0
                kZ = 0

                aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
                aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(
                    aDistance,
                    kPositionReferenceDistance,
                    kPositionRolloffFactor)
                aPositionOut = aOut * min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
                AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
                a1 += lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aPositionOut
                a2 += lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aPositionOut
                a3 += lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aPositionOut
                a4 += lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aPositionOut

                kRimPositionIndex += 1
                kRimPositionIndexWithOffset += iRimPositionIndexOffset
            ; od
            ; kPrinted = true

            ${CSOUND_IFDEF} IS_GENERATING_JSON
                iPositionIndex = \
                    gi${InstrumentName}_RimPositionOffset \
                    + (iMeshRow * iMeshSegmentCountD2)
                iPositionIndex = iPositionIndex % iRimIndexCount
                fprints(SJsonFile, ",\"positionIndex\":%d", iPositionIndex)
            ${CSOUND_ENDIF}

            if (iNoteNumber == gi${InstrumentName}_NoteNumber3) then
                gi${InstrumentName}_RimPositionOffset += 1
            endif
        else
            // Position disabled.
            a1 = 0
            a2 = 0
            a3 = 0
            a4 = aOut
        endif

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + a2
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + a3
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + a4
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aOut
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
            if (lastcycle() == true) then
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
