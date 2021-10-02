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

giGroundBubbleSynth_Duration = 60 // Time in seconds for all notes to be started.
giGroundBubbleSynth_GridColumnCount = 30
giGroundBubbleSynth_GridRowCount = giGroundBubbleSynth_GridColumnCount
giGroundBubbleSynth_GridCellSize = 30
giGroundBubbleSynth_StartY = 0
giGroundBubbleSynth_FullVolumeY = 2
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
giGroundBubbleSynth_GridCenterX = (giGroundBubbleSynth_GridColumnCount * giGroundBubbleSynth_GridCellSize) / 2
giGroundBubbleSynth_GridCenterZ = (giGroundBubbleSynth_GridRowCount * giGroundBubbleSynth_GridCellSize) / 2

giGroundBubbleSynth_GridCellIndex = 0
giGroundBubbleSynth_GridCellIndexIncrementAmount = 30
giGroundBubbleSynth_GridCellIndexBase = 0

opcode incrementGridCellIndex, 0, 0
    giGroundBubbleSynth_GridCellIndex += giGroundBubbleSynth_GridCellIndexIncrementAmount
    if (giGroundBubbleSynth_GridCellIndex >= giGroundBubbleSynth_GridCellCount) then
        giGroundBubbleSynth_GridCellIndexBase += 1
        giGroundBubbleSynth_GridCellIndex = giGroundBubbleSynth_GridCellIndexBase
    fi
endop

iSpiralIndex = 0
while (iSpiralIndex < giGroundBubbleSynth_GridColumnCount / 2) do
    // Across top, left to right.
    iSpiralColumnIndex = iSpiralIndex
    iSpiralRowIndex = iSpiralIndex
    while (iSpiralColumnIndex < giGroundBubbleSynth_GridColumnCount - iSpiralIndex) do
        log_i_debug("cell = %d, column = %d, row = %d", giGroundBubbleSynth_GridCellIndex, iSpiralColumnIndex, iSpiralRowIndex)
        giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][0] = iSpiralColumnIndex
        giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][1] = iSpiralRowIndex
        iSpiralColumnIndex += 1
        incrementGridCellIndex()
    od
    iSpiralColumnIndex -= 1

    // Down right side.
    iSpiralRowIndex += 1
    while (iSpiralRowIndex < giGroundBubbleSynth_GridRowCount - iSpiralIndex) do
        log_i_debug("cell = %d, column = %d, row = %d", giGroundBubbleSynth_GridCellIndex, iSpiralColumnIndex, iSpiralRowIndex)
        giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][0] = iSpiralColumnIndex
        giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][1] = iSpiralRowIndex        
        iSpiralRowIndex += 1
        incrementGridCellIndex()
    od
    iSpiralRowIndex -= 1

    // Across bottom, right to left.
    iSpiralColumnIndex -= 1
    while (iSpiralColumnIndex >= iSpiralIndex) do
        log_i_debug("cell = %d, column = %d, row = %d", giGroundBubbleSynth_GridCellIndex, iSpiralColumnIndex, iSpiralRowIndex)
        giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][0] = iSpiralColumnIndex
        giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][1] = iSpiralRowIndex        
        iSpiralColumnIndex -= 1
        incrementGridCellIndex()
    od
    iSpiralColumnIndex += 1

    // Up left side.
    iSpiralRowIndex -= 1
    while (iSpiralRowIndex > iSpiralIndex) do
        log_i_debug("cell = %d, column = %d, row = %d", giGroundBubbleSynth_GridCellIndex, iSpiralColumnIndex, iSpiralRowIndex)
        giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][0] = iSpiralColumnIndex
        giGroundBubbleSynth_GridCellLaunchPattern[giGroundBubbleSynth_GridCellIndex][1] = iSpiralRowIndex        
        iSpiralRowIndex -= 1
        incrementGridCellIndex()
    od

    iSpiralIndex += 1
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
                "i %.6f %.03f -1 %d %.3f %.3f %d",
                p1 + iInstrumentNumberFraction / 1000000,
                iNoteOnTime,
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
        
        kX init iGridColumn * giGroundBubbleSynth_GridCellSize - giGroundBubbleSynth_GridCenterX
        kZ init iGridRow * giGroundBubbleSynth_GridCellSize - giGroundBubbleSynth_GridCenterZ
        ; log_i_debug("xyz = (%.3f, %.3f, %.3f)", i(kX), i(kY), i(kZ))
        kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
        if (kDistance > giGroundBubbleSynth_MaxAudibleDistance) then
            kgoto end
        fi

        kCps = iCps + kY * 10
        kAmp = iAmp
        if (kY < giGroundBubbleSynth_FullVolumeY) then
            kAmp *= kY / giGroundBubbleSynth_FullVolumeY
        fi
        kAmp *= kDistance / giGroundBubbleSynth_MaxAudibleDistance

        aOut = tone(
            oscil(kAmp + jspline(kAmp, 0.08, 0.05), kCps * 0.918) + \
            oscil(kAmp + jspline(kAmp, 0.07, 0.49), kCps * 2.234) + \
            oscil(kAmp + jspline(kAmp, 0.09, 0.50), kCps * 3.83) + \
            oscil(kAmp + jspline(kAmp, 0.10, 0.45), kCps * 4.11) + \
            oscil(kAmp + jspline(kAmp, 0.09, 0.51), kCps * 5.25) + \
            oscil(kAmp + jspline(kAmp, 0.08, 0.50), kCps * 6.093) + \
            oscil(kAmp + jspline(kAmp, 0.08, 0.50), kCps * 7.77) + \
            oscil(kAmp + jspline(kAmp, 0.10, 0.40), kCps * 8.328) + \
            oscil(kAmp + jspline(kAmp, 0.07, 0.55), kCps * 9.129) + \
            oscil(kAmp + jspline(kAmp, 0.08, 0.47), kCps * kCps / 100),
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
        a5 += 0.25 * aOutDistanced * iPlaybackReverbAdjustment

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
            if (giGroundBubbleSynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"GroundBubbleSynth_Json\" 0 0")
            endif
            giGroundBubbleSynth_NoteIndex[ORC_INSTANCE_INDEX] = giGroundBubbleSynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json", INSTRUMENT_PLUGIN_UUID, giGroundBubbleSynth_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f,\"column\":%d,\"row\":%d}}",
                times(), iGridColumn, iGridRow)
            ficlose(SJsonFile)
        ${CSOUND_ENDIF}
    endif
end:
endin


#if IS_PLAYBACK
    instr CONCAT(Preallocate_, INSTRUMENT_ID)
        ii = 0
        iCount = giPresetUuidPreallocationCount[INSTRUMENT_TRACK_INDEX]
        while (ii < iCount) do
            scoreline_i(sprintf("i %d.%.3d 0 1 %d 0 0",
                INSTRUMENT_ID,
                ii,
                EVENT_NOTE_GENERATED))
            ii += 1
        od
        turnoff
    endin
    scoreline_i(sprintf("i \"Preallocate_%d\" 0 -1", INSTRUMENT_ID))
#endif

//----------------------------------------------------------------------------------------------------------------------
