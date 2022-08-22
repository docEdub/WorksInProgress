#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: TriangleUdoTriggerSynth.orc
//
// Description:
//  Triggers a different synth UDO for each MIDI key received.
//----------------------------------------------------------------------------------------------------------------------

#include "synth-before-include-guard.h.orc"

#ifndef ${InstrumentName}_orc__include_guard
#define ${InstrumentName}_orc__include_guard

#include "synth-inside-include-guard.h.orc"


giTriangle3MonoSynth_PlaybackVolumeAdjustment = 0.9
giTriangle3MonoSynth_PlaybackReverbAdjustment = 1.5

giTriangle3MonoSynth_NoteIndex[] init ORC_INSTANCE_COUNT
gkTriangle3MonoSynth_NoteNumber[] init ORC_INSTANCE_COUNT

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

#include "TriangleUdo1.h.orc"

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
        iNoteNumber = p5
        iVelocity = p6

        aOut init 0

        log_i_debug("iNoteNumber == %d", iNoteNumber)

        if (iNoteNumber == 60) then
            aOut = dEd_TriangleUdo1()
        endif

        if (CC_VALUE_i(positionEnabled) == true) then
            ; log_i_trace("Calling position UDO ...")
            #include "Position_kXYZ.orc"

            aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
            aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
            aOut *= min(aDistanceAmp, a(kPositionMaxAmpWhenClose))

            AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
            a1 = median(a(gkAmbisonicChannelGains[0]), $AF_3D_LISTENER_LAG_SAMPLES, $AF_3D_LISTENER_LAG_SAMPLES) * aOut
            a2 = median(a(gkAmbisonicChannelGains[1]), $AF_3D_LISTENER_LAG_SAMPLES, $AF_3D_LISTENER_LAG_SAMPLES) * aOut
            a3 = median(a(gkAmbisonicChannelGains[2]), $AF_3D_LISTENER_LAG_SAMPLES, $AF_3D_LISTENER_LAG_SAMPLES) * aOut
            a4 = median(a(gkAmbisonicChannelGains[3]), $AF_3D_LISTENER_LAG_SAMPLES, $AF_3D_LISTENER_LAG_SAMPLES) * aOut
        else
            // Disabled.
            a1 = aOut
            a2 = 0
            a3 = 0
            a4 = 0
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
            if (giTR_808_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i(sprintf("i \"%s\" 0 0", STRINGIZE(CONCAT(Json_, INSTRUMENT_ID))))
            endif
            giTR_808_NoteIndex[ORC_INSTANCE_INDEX] = giTR_808_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giTR_808_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f}}", times())
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

//----------------------------------------------------------------------------------------------------------------------
