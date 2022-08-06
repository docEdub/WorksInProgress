#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Saw2FlyerSynth.orc
//
// Description:
//  Single saw wave oscillator with doppler effect.
//----------------------------------------------------------------------------------------------------------------------

#include "synth-before-include-guard.h.orc"

#ifndef ${InstrumentName}_orc__include_guard
#define ${InstrumentName}_orc__include_guard

#include "synth-inside-include-guard.h.orc"

${CSOUND_INCLUDE} "json.orc"

gi${InstrumentName}_PlaybackVolumeAdjustment = 0.9
gi${InstrumentName}_PlaybackReverbAdjustment = 1.5

gi${InstrumentName}_NoteIndex[] init ORC_INSTANCE_COUNT

#include "Common/FlyerPath.orc"

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    gSPluginUuids[INSTRUMENT_TRACK_INDEX][INSTRUMENT_PLUGIN_INDEX] = INSTRUMENT_PLUGIN_UUID

    instr CONCAT(Json_, INSTRUMENT_ID)
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        iPositionIndexOffset = (gi${InstrumentName}_MeshSegmentCount / 2) / gi${InstrumentName}_RimPositionCount
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

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i(sprintf("i \"%s\" 0 0", STRINGIZE(CONCAT(Json_, INSTRUMENT_ID))))
            endif
            gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] = gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX])
            iOnTime = times()
            fprints(SJsonFile, "{\"note\":{\"onTime\":%.3f,\"pitch\":%.3f", iOnTime, iNoteNumber)
        ${CSOUND_ENDIF}

        // Oscillator
        //--------------------------------------------------------------------------------------------------------------
        kAmp init 0.333 * (iVelocity / 127)
        aOut = vco2(kAmp, cpsmidinn(iNoteNumber), VCO2_WAVEFORM_INTEGRATED_SAWTOOTH)

        if (CC_VALUE_k(positionEnabled) == true) then
            #include "Position_kXYZ.orc"

            aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
            aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(
                aDistance,
                kPositionReferenceDistance,
                kPositionRolloffFactor)
            aPositionOut = aOut * min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
            aReverbOut = aOut * (1 - (1 - aDistanceAmp) / 5)
            AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
            a1 = lag:a(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_TIME) * aPositionOut
            a2 = lag:a(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_TIME) * aPositionOut
            a3 = lag:a(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_TIME) * aPositionOut
            a4 = lag:a(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_TIME) * aPositionOut
        else
            // Position disabled.
            a1 = aOut
            a2 = 0
            a3 = 0
            a4 = 0
        endif

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + a2
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + a3
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + a4
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aReverbOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aReverbOut
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
            outc(a1, a2, a3, a4, aReverbOut, aReverbOut)
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
