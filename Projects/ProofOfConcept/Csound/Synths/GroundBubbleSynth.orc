#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: GroundBubbleSynth.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef GroundBubbleSynth_orc__include_guard
#define GroundBubbleSynth_orc__include_guard

${CSOUND_INCLUDE} "adsr_linsegr.udo.orc"

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    "example",                                  "bool",     "false",            "synced", _(\)
_(\)
    "",                                         "",         "",                 "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #8#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    CREATE_CC_INDEX(example)

    turnoff
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
${CSOUND_INCLUDE} "math.orc"

giGroundBubbleSynth_Duration = 90 // Time in seconds for all notes to be started.
giGroundBubbleSynth_GridColumnCount = 30
giGroundBubbleSynth_GridRowCount = giGroundBubbleSynth_GridColumnCount
giGroundBubbleSynth_GridCellSize = 30
giGroundBubbleSynth_StartY = 2
giGroundBubbleSynth_SpeedY = 5 // Units per second.
giGroundBubbleSynth_MaxAudibleDistance = 100 // Inaudible beyond max distance.
giGroundBubbleSynth_MaxAudibleHeight = 100 // Inaudible above max height.
giGroundBubbleSynth_MaxAmpWhenVeryClose = 0.5
giGroundBubbleSynth_ReferenceDistance = 0.1
giGroundBubbleSynth_RolloffFactor = 0.0025
giGroundBubbleSynth_PlaybackVolumeAdjustment = 2.5
giGroundBubbleSynth_PlaybackReverbAdjustment = 0.25

giGroundBubbleSynth_NoteIndex[] init ORC_INSTANCE_COUNT

giGroundBubbleSynth_GridCellCount = giGroundBubbleSynth_GridColumnCount * giGroundBubbleSynth_GridRowCount
giGroundBubbleSynth_GridCellLaunchPattern[][] init giGroundBubbleSynth_GridCellCount, 2

iGridCellIndex = 0
iSpiralIndex = 0
while (iSpiralIndex < giGroundBubbleSynth_GridColumnCount / 2) do
    // Across top, left to right.
    iSpiralColumnIndex = iSpiralIndex
    while (iSpiralColumnIndex < giGroundBubbleSynth_GridColumnCount - iSpiralIndex) do
        giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][0] = iSpiralColumnIndex
        giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][1] = 0
        iSpiralColumnIndex += 1
        iGridCellIndex += 1
    od

    // Down right side.
    iSpiralRowIndex = iSpiralIndex + 1
    while (iSpiralRowIndex < giGroundBubbleSynth_GridRowCount - iSpiralIndex) do
        giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][0] = iSpiralColumnIndex
        giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][1] = iSpiralRowIndex        
        iSpiralRowIndex += 1
        iGridCellIndex += 1
    od

    // Across bottom, right to left.
    while (iSpiralColumnIndex >= iSpiralIndex) do
        giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][0] = iSpiralColumnIndex
        giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][1] = iSpiralRowIndex        
        iSpiralColumnIndex -= 1
        iGridCellIndex += 1
    od

    // Up left side.
    while (iSpiralRowIndex > iSpiralIndex) do
        giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][0] = iSpiralColumnIndex
        giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][1] = iSpiralRowIndex        
        iSpiralRowIndex -= 1
        iGridCellIndex += 1
    od
od

#endif // #ifndef GroundBubbleSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr GroundBubbleSynth_Json
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, sprintf(",\"duration\":%d", giGroundBubbleSynth_Duration))
        fprints(SJsonFile, sprintf(",\"gridColumnCount\":%d", giGroundBubbleSynth_GridColumnCount))
        fprints(SJsonFile, sprintf(",\"gridRowCount\":%d", giGroundBubbleSynth_GridRowCount))
        fprints(SJsonFile, sprintf(",\"gridCellSize\":%d", giGroundBubbleSynth_GridCellSize))
        fprints(SJsonFile, sprintf(",\"maxDistance\":%d", giGroundBubbleSynth_MaxAudibleDistance))
        fprints(SJsonFile, sprintf(",\"maxHeight\":%d", giGroundBubbleSynth_MaxAudibleHeight))
        fprints(SJsonFile, "}")
        turnoff
    endin
${CSOUND_ENDIF}


instr INSTRUMENT_ID

    iEventType = p4
    if (iEventType == EVENT_CC) then
        turnoff

#if !IS_PLAYBACK
    elseif (iEventType == EVENT_NOTE_ON) then
        iInstrumentNumberFraction = 1

        if (i(gk_mode) == 4) then
            // Skip to end if track index is -1 due to mode switch lag.
            if (gk_trackIndex == -1) kgoto end

            iNoteOnTime = elapsedTime_i()
            iGridCellIndex = 0
            while (iGridCellIndex < giGroundBubbleSynth_GridCellCount) do
                iGridColumn = giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][0]
                iGridRow = giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][1]
                sendScoreMessage_i(sprintf(
                    "i  CONCAT(%s_%d, .%03d) %.03f -1 EVENT_NOTE_GENERATED %d %d",
                    STRINGIZE(${InstrumentName}),
                    i(gk_trackIndex),
                    iInstrumentNumberFraction,
                    iNoteOnTime,
                    iGridColumn,
                    iGridRow))
                iGridCellIndex += 1
                iNoteOnTime += giGroundBubbleSynth_Duration / giGroundBubbleSynth_GridCellCount
                iInstrumentNumberFraction += 1
            od
            goto end
        endif

        iNoteOnTime = 0
        iGridCellIndex = 0
        while (iGridCellIndex < giGroundBubbleSynth_GridCellCount) do
            iGridColumn = giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][0]
            iGridRow = giGroundBubbleSynth_GridCellLaunchPattern[iGridCellIndex][1]
            SEvent = sprintf(
                "i %.6f %.03f %.3f %d %.3f %.3f %d",
                p1 + iInstrumentNumberFraction / 1000000,
                iNoteOnTime,
                giGroundBubbleSynth_Duration,
                EVENT_NOTE_GENERATED,
                iGridColumn,
                iGridRow)
            scoreline_i(SEvent)
            iGridCellIndex += 1
            iNoteOnTime += giGroundBubbleSynth_Duration / giGroundBubbleSynth_GridCellCount
            iInstrumentNumberFraction += 1
        od
#endif

    elseif (iEventType == EVENT_NOTE_GENERATED) then
        iGridColumn = p5
        iGridRow = p6

        iCps = 220
        iAmp = 0.05
        iCutoffFrequency = 1000
        
        kY init giGroundBubbleSynth_StartY
        kY += giGroundBubbleSynth_SpeedY * (1 / kr)
        if (kY > giGroundBubbleSynth_MaxAudibleHeight) then
            turnoff
        fi
        
        kX init iGridColumn * giGroundBubbleSynth_GridCellSize
        kZ init iGridRow * giGroundBubbleSynth_GridCellSize
        kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
        if (kDistance > giGroundBubbleSynth_MaxAudibleDistance) then
            kgoto end
        fi

        aOut = tone(
            oscil(iAmp + jspline(iAmp, 0.08, 0.05), iCps * 0.918) + \
            oscil(iAmp + jspline(iAmp, 0.07, 0.49), iCps * 2.234) + \
            oscil(iAmp + jspline(iAmp, 0.09, 0.50), iCps * 3.83) + \
            oscil(iAmp + jspline(iAmp, 0.10, 0.45), iCps * 4.11) + \
            oscil(iAmp + jspline(iAmp, 0.09, 0.51), iCps * 5.25) + \
            oscil(iAmp + jspline(iAmp, 0.08, 0.50), iCps * 6.093) + \
            oscil(iAmp + jspline(iAmp, 0.08, 0.50), iCps * 7.77) + \
            oscil(iAmp + jspline(iAmp, 0.10, 0.40), iCps * 8.328) + \
            oscil(iAmp + jspline(iAmp, 0.07, 0.55), iCps * 9.129) + \
            oscil(iAmp + jspline(iAmp, 0.08, 0.47), iCps * iCps / 100),
            iCutoffFrequency)

        #if IS_PLAYBACK
            a1 = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0]
            a2 = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1]
            a3 = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2]
            a4 = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3]
            a5 = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] // Reverb
        #else
            a1 = 0
            a2 = 0
            a3 = 0
            a4 = 0
            a5 = 0 // Reverb
        #endif

        kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giGroundBubbleSynth_ReferenceDistance, giGroundBubbleSynth_RolloffFactor)
        kDistanceAmp = min(kDistanceAmp, giGroundBubbleSynth_MaxAmpWhenVeryClose)
        #if IS_PLAYBACK
            kDistanceAmp *= giGroundBubbleSynth_PlaybackVolumeAdjustment
        #endif
        aOutDistanced = aOut * kDistanceAmp

        AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
        iPlaybackReverbAdjustment init 1
        #if IS_PLAYBACK
            iPlaybackReverbAdjustment = giGroundBubbleSynth_PlaybackReverbAdjustment
        #endif

        a1 += gkAmbisonicChannelGains[0] * aOutDistanced
        a2 += gkAmbisonicChannelGains[1] * aOutDistanced
        a3 += gkAmbisonicChannelGains[2] * aOutDistanced
        a4 += gkAmbisonicChannelGains[3] * aOutDistanced
        a5 += aOut * 2 * kDistanceAmp * iPlaybackReverbAdjustment

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = a2
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = a3
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = a4
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = a5
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = a5
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
            outc(a1, a2, a3, a4, a5, a5)
        #endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (iDelayIndex == 0) then
                if (giGroundBubbleSynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                    scoreline_i("i \"GroundBubbleSynth_Json\" 0 0")
                endif
                giGroundBubbleSynth_NoteIndex[ORC_INSTANCE_INDEX] = giGroundBubbleSynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
                SJsonFile = sprintf("json/%s.%d.json", INSTRUMENT_PLUGIN_UUID, giGroundBubbleSynth_NoteIndex[ORC_INSTANCE_INDEX])
                fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f,\"column\":%d,\"row\":%d}}",
                    times(), iGridColumn, iGridRow)
                ficlose(SJsonFile)
            endif
        ${CSOUND_ENDIF}
    endif
end:
endin

//----------------------------------------------------------------------------------------------------------------------
