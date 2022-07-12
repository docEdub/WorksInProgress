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
gi${InstrumentName}_NoteNumberLfoAmp = 0.333

gi${InstrumentName}_NoteIndex[] init ORC_INSTANCE_COUNT

// Mesh geometry generated in Javascript.
#if IS_PLAYBACK
    gi${InstrumentName}_MeshSegmentCount init _($){Rim1HiArpMesh.segments}
    gi${InstrumentName}_MeshRowCount init _($){Rim1HiArpMesh.rows}
    gi${InstrumentName}_MeshAudioPositions[] init _($){Rim1HiArpMesh.audioPositionsString}
#else
    gi${InstrumentName}_MeshSegmentCount init 1
    gi${InstrumentName}_MeshRowCount init 1
    gi${InstrumentName}_MeshAudioPositions[] init 1 // [segment, row, xyz]

    instr ${InstrumentName}_MeshSegmentCount
        if (gi${InstrumentName}_MeshSegmentCount != p4) then
            gi${InstrumentName}_MeshSegmentCount = p4
            iMeshAudioPositions[] init gi${InstrumentName}_MeshSegmentCount * gi${InstrumentName}_MeshRowCount * 3
            gi${InstrumentName}_MeshAudioPositions = iMeshAudioPositions
        endif
        turnoff
    endin

    instr ${InstrumentName}_MeshRowCount
        if (gi${InstrumentName}_MeshRowCount != p4) then
            gi${InstrumentName}_MeshRowCount = p4
            iMeshAudioPositions[] init gi${InstrumentName}_MeshSegmentCount * gi${InstrumentName}_MeshRowCount * 3
            gi${InstrumentName}_MeshAudioPositions = iMeshAudioPositions
        endif
        turnoff
    endin

    instr ${InstrumentName}_MeshAudioPosition
        iIndex = p4
        iX = p5
        iY = p6
        iZ = p7
        log_i_trace(
            "instr ${InstrumentName}_MeshAudioPositions: iSegment = %d, iRow = %d, iX = %.3f, iY = %.3f, iZ = %.3f",
            iIndex % gi${InstrumentName}_MeshSegmentCount,
            floor(iIndex / gi${InstrumentName}_MeshSegmentCount),
            iX,
            iY,
            iZ)
        if (iIndex < gi${InstrumentName}_MeshSegmentCount * gi${InstrumentName}_MeshRowCount) then
            iIndex *= 3
            gi${InstrumentName}_MeshAudioPositions[iIndex] = iX
            gi${InstrumentName}_MeshAudioPositions[iIndex + 1] = iY
            gi${InstrumentName}_MeshAudioPositions[iIndex + 2] = iZ
        endif
        turnoff
    endin

    instr ${InstrumentName}_MeshSegmentCountString
        SCount init "0"
        SCount = strget(p4)
        iCount = strtod(SCount)
        scoreline_i(sprintf("i\"${InstrumentName}_MeshSegmentCount\" 0 1 %d", iCount))
        turnoff
    endin

    instr ${InstrumentName}_MeshRowCountString
        SCount init "0"
        SCount = strget(p4)
        iCount = strtod(SCount)
        scoreline_i(sprintf("i\"${InstrumentName}_MeshRowCount\" 0 1 %d", iCount))
        turnoff
    endin

    instr ${InstrumentName}_MeshAudioPositionString
        SArgs[] = string_split_i(strget(p4), "/")
        iInstrumentNumber = nstrnum("${InstrumentName}_MeshAudioPosition") + frac(p1)
        scoreline_i(sprintf("i%f 0 1 %s %s %s %s", iInstrumentNumber, SArgs[0], SArgs[1], SArgs[2], SArgs[3]))
        turnoff
    endin

    instr ${InstrumentName}_MeshJavascriptOscHandler
        if (gi_oscHandle == -1) then
            // Restart this instrument to see if the OSC handle has been set, yet.
            log_i_trace("OSC not initialized. Restarting instrument in 1 second.")
            event("i", p1, 1, -1)
            turnoff
        else
            log_i_trace("Listening for geometry Javascript OSC messages on port %d.", gi_oscPort)

            SMeshSegmentCount init "0"
            kReceived = OSClisten(
                gi_oscHandle,
                sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "MeshSegmentCount"),
                "s",
                SMeshSegmentCount)
            if (kReceived == true) then
                log_k_debug("MeshSegmentCount = %s", SMeshSegmentCount)
                scoreline(sprintfk("i\"${InstrumentName}_MeshSegmentCountString\" 0 1 \"%s\"", SMeshSegmentCount), 1)
            endif

            SMeshRowCount init "0"
            kReceived = OSClisten(
                gi_oscHandle,
                sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "MeshRowCount"),
                "s",
                SMeshRowCount)
            if (kReceived == true) then
                log_k_debug("MeshRowCount = %s", SMeshRowCount)
                scoreline(sprintfk("i\"${InstrumentName}_MeshRowCountString\" 0 1 \"%s\"", SMeshRowCount), 1)
            endif

            SMeshAudioPosition init "0"
            kReceived = true
            iMeshAudioPositionStringInstrumentNumber = nstrnum("${InstrumentName}_MeshAudioPositionString")
            kInstrumentNumberFraction = 1
            while (kReceived == true) do
                kReceived = OSClisten(
                    gi_oscHandle,
                    sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "MeshAudioPosition"),
                    "s",
                    SMeshAudioPosition)
                if (kReceived == true) then
                    ; log_k_debug("MeshAudioPosition = %s", SMeshAudioPosition)
                    scoreline(
                        sprintfk("i%d.%05d 0 1 \"%s\"",
                            iMeshAudioPositionStringInstrumentNumber,
                            kInstrumentNumberFraction,
                            SMeshAudioPosition),
                        1)
                endif
                kInstrumentNumberFraction += 1
            od
        endif
    endin
    scoreline_i("i \"${InstrumentName}_MeshJavascriptOscHandler\" 0 -1")
#endif

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr CONCAT(Json_, INSTRUMENT_ID)
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
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

            kX = 0
            kY = 0
            kZ = 0

            aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
            aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(
                aDistance,
                kPositionReferenceDistance,
                kPositionRolloffFactor)
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
            if (giSaw1RimSynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i(sprintf("i \"%s\" 0 0", STRINGIZE(CONCAT(Json_, INSTRUMENT_ID))))
            endif
            giSaw1RimSynth_NoteIndex[ORC_INSTANCE_INDEX] = giSaw1RimSynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giSaw1RimSynth_NoteIndex[ORC_INSTANCE_INDEX])
            iOnTime = times()
            SJsonData = sprintf("{\"note\":{\"onTime\":%.3f,\"pitch\":%.3f", iOnTime, iNoteNumber)
            if (lastcycle() == true) then
                fprintks(SJsonFile, ",\"offTime\":%.3f}}", timeinsts() + iOnTime)
                scoreline(sprintfk("i \"Json_CloseFile\" 0 -1 \"%s\"", SJsonFile), 1)
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
