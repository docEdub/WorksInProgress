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

#define FLYER_DIRECTION_UNKNOWN 0
#define FLYER_DIRECTION_CLOCKWISE 1
#define FLYER_DIRECTION_COUNTERCLOCKWISE 2
#define FLYER_DIRECTION_BOTH 3

#define CSD_CC_INFO \
    "flyerDirectionComboBoxIndex",  "number",   "0",    "synced",   \
    "flyerDirection",               "string",   "",     "synced",   \

#define CSD_CC_INFO_COUNT 8

#define HAS_CSD_CC_INDEXES_ORC

#include "synth-inside-include-guard.h.orc"
${CSOUND_INCLUDE} "json.orc"
${CSOUND_INCLUDE} "time_NoteTime.orc"

gi${InstrumentName}_PlaybackVolumeAdjustment = 0.9
gi${InstrumentName}_PlaybackReverbAdjustment = 1.5

gi${InstrumentName}_NoteIndex[] init ORC_INSTANCE_COUNT

#include "Common/FlyerPaths.orc"

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
        iFlyerDirection = CC_VALUE_i(flyerDirectionComboBoxIndex)

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
            fprints(SJsonFile, "{\"note\":{\"onTime\":%.3f,\"pitch\":%.3f,\"flyerDirection\":%d", iOnTime, iNoteNumber, iFlyerDirection)
        ${CSOUND_ENDIF}

        if (CC_VALUE_k(positionEnabled) == true) then
            #include "Position_kXYZ.orc"

            a1 = 0
            a2 = 0
            a3 = 0
            a4 = 0

            // Position on path
            //---------------------------------------------------------------------------------------------------------
            iFlyerIndex init -1
            if (iNoteNumber == 98) then // D
                iFlyerIndex = 0
            elseif (iNoteNumber == 101) then // F
                iFlyerIndex = 1
            elseif (iNoteNumber == 105) then // A
                iFlyerIndex = 2
            endif
            kNoteTime = time_NoteTime:k()
            kPointIndexAndFraction = kNoteTime * gi${InstrumentName}_PathSpeedMultipler[iFlyerIndex]
            kPointIndex = min(gi${InstrumentName}_PathPointLastIndex - 1, floor:k(kPointIndexAndFraction))

            kPoint1[] init 3
            kPoint2[] init 3
            kCoordinateIndex = kPointIndex * 3
            kPoint1[$X] = gi${InstrumentName}_PathAudioPoints[iFlyerIndex][kCoordinateIndex]
            kPoint1[$Y] = gi${InstrumentName}_PathAudioPoints[iFlyerIndex][kCoordinateIndex + 1]
            kPoint1[$Z] = gi${InstrumentName}_PathAudioPoints[iFlyerIndex][kCoordinateIndex + 2]
            kPoint2[$X] = gi${InstrumentName}_PathAudioPoints[iFlyerIndex][kCoordinateIndex + 3]
            kPoint2[$Y] = gi${InstrumentName}_PathAudioPoints[iFlyerIndex][kCoordinateIndex + 4]
            kPoint2[$Z] = gi${InstrumentName}_PathAudioPoints[iFlyerIndex][kCoordinateIndex + 5]

            kPointFraction = frac(kPointIndexAndFraction)
            kX = kPoint1[$X] + (kPoint2[$X] - kPoint1[$X]) * kPointFraction
            kY = kPoint1[$Y] + (kPoint2[$Y] - kPoint1[$Y]) * kPointFraction
            kZ = kPoint1[$Z] + (kPoint2[$Z] - kPoint1[$Z]) * kPointFraction

            if (iFlyerDirection == FLYER_DIRECTION_COUNTERCLOCKWISE) then
                kZ = -kZ
            endif

            // Doppler effect
            //---------------------------------------------------------------------------------------------------------
            kDoppler_currentDistance init -1
            kDoppler_currentTime init 0
            kDoppler_previousTime init 0
            kDoppler_deltaTime_x100 init 0

            kDoppler_previousDistance = kDoppler_currentDistance

            kDoppler_currentDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
            kDoppler_currentTime = kNoteTime
            kDoppler_deltaTime_x100 = (kDoppler_currentTime - kDoppler_previousTime) * 100

            if (kDoppler_previousDistance == -1) then
                kDoppler_previousDistance = kDoppler_currentDistance
            endif

            kDoppler_factor = AF_3D_Audio_DopplerShift(
                kDoppler_previousDistance,
                kDoppler_currentDistance,
                kDoppler_deltaTime_x100)

            // Oscillator
            //---------------------------------------------------------------------------------------------------------
            kAmp init 0.333 * (iVelocity / 127)
            aOut = vco2(kAmp, kDoppler_factor * cpsmidinn(iNoteNumber), VCO2_WAVEFORM_INTEGRATED_SAWTOOTH)

            // Volume envelope
            //---------------------------------------------------------------------------------------------------------
            iEnvelopeA = 0.01
            iEnvelopeD = 0.1
            iEnvelopeS = 0.667
            iEnvelopeR = 1 / gi${InstrumentName}_PathSpeedMultipler[iFlyerIndex]

            aVolumeEnvelope = MIDIFY_OPCODE(xadsr):a(iEnvelopeA, iEnvelopeD, iEnvelopeS, iEnvelopeR)
            aOut *= aVolumeEnvelope

            // Spatialization
            //---------------------------------------------------------------------------------------------------------
            aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
            aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(
                aDistance,
                kPositionReferenceDistance,
                kPositionRolloffFactor)
            aPositionOut = aOut * min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
            aReverbOut = aOut * aDistanceAmp
            AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
            a1 = a(gkAmbisonicChannelGains[0]) * aPositionOut
            a2 = a(gkAmbisonicChannelGains[1]) * aPositionOut
            a3 = a(gkAmbisonicChannelGains[2]) * aPositionOut
            a4 = a(gkAmbisonicChannelGains[3]) * aPositionOut

            if (iFlyerDirection == FLYER_DIRECTION_BOTH) then
                kZ = -kZ

                // Doppler effect
                //---------------------------------------------------------------------------------------------------------
                kDoppler_currentDistance2 init -1

                kDoppler_previousDistance2 = kDoppler_currentDistance2

                kDoppler_currentDistance2 = AF_3D_Audio_SourceDistance(kX, kY, kZ)

                if (kDoppler_previousDistance2 == -1) then
                    kDoppler_previousDistance2 = kDoppler_currentDistance2
                endif

                kDoppler_factor2 = AF_3D_Audio_DopplerShift(
                    kDoppler_previousDistance2,
                    kDoppler_currentDistance2,
                    kDoppler_deltaTime_x100)

                // Oscillator
                //---------------------------------------------------------------------------------------------------------
                kAmp init 0.333 * (iVelocity / 127)
                aOut = vco2(kAmp, kDoppler_factor2 * cpsmidinn(iNoteNumber), VCO2_WAVEFORM_INTEGRATED_SAWTOOTH)

                // Volume envelope
                //---------------------------------------------------------------------------------------------------------
                aOut *= aVolumeEnvelope

                // Spatialization
                //---------------------------------------------------------------------------------------------------------
                aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
                aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(
                    aDistance,
                    kPositionReferenceDistance,
                    kPositionRolloffFactor)
                aPositionOut = aOut * min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
                aReverbOut += aOut * aDistanceAmp
                AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
                a1 += a(gkAmbisonicChannelGains[0]) * aPositionOut
                a2 += a(gkAmbisonicChannelGains[1]) * aPositionOut
                a3 += a(gkAmbisonicChannelGains[2]) * aPositionOut
                a4 += a(gkAmbisonicChannelGains[3]) * aPositionOut
            endif

            kDoppler_previousTime = kDoppler_currentTime
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
