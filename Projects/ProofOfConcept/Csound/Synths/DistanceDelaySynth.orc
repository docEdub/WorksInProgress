#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: DistanceDelaySynth.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef DistanceDelaySynth_orc__include_guard
#define DistanceDelaySynth_orc__include_guard

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

giDistanceDelaySynth_StartDistance = 50
giDistanceDelaySynth_DelayDistance = 40
giDistanceDelaySynth_DelayTime = 0.5 // seconds
giDistanceDelaySynth_Duration = 0.49 // seconds
giDistanceDelaySynth_DelayCount = 5
giDistanceDelaySynth_MaxAmpWhenVeryClose = 0.5
giDistanceDelaySynth_ReferenceDistance = 5
giDistanceDelaySynth_RolloffFactor = 1
giDistanceDelaySynth_PlaybackVolumeAdjustment = 5
giDistanceDelaySynth_PlaybackReverbAdjustment = 0.25

giDistanceDelaySynth_NoteIndex[] init ORC_INSTANCE_COUNT
giDistanceDelaySynth_InstrumentNumberFraction[] init ORC_INSTANCE_COUNT

#endif // #ifndef DistanceDelaySynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr DistanceDelaySynth_Json
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, sprintf(",\"startDistance\":%d", giDistanceDelaySynth_StartDistance))
        fprints(SJsonFile, sprintf(",\"delayDistance\":%d", giDistanceDelaySynth_DelayDistance))
        fprints(SJsonFile, sprintf(",\"delayTime\":%.02f", giDistanceDelaySynth_DelayTime))
        fprints(SJsonFile, sprintf(",\"duration\":%.01f", giDistanceDelaySynth_Duration))
        fprints(SJsonFile, sprintf(",\"delayCount\":%d", giDistanceDelaySynth_DelayCount))
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
        iNoteNumber = p5
        iVelocity = p6

        giDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = giDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] + 1
        if (giDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] == 1000) then
            giDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = 1
        endif
        iInstrumentNumberFraction = giDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX]

        if (i(gk_mode) == 4) then
            // Skip to end if track index is -1 due to mode switch lag.
            if (gk_trackIndex == -1) kgoto end

            iNoteOnTime = elapsedTime_i()
            iI = 0
            while (iI < giDistanceDelaySynth_DelayCount) do
                sendScoreMessage_i(sprintf(
                    "i  CONCAT(%s_%d, .%03d) %.03f %.03f EVENT_NOTE_GENERATED Note(%d) Velocity(%d) %d",
                    STRINGIZE(${InstrumentName}),
                    i(gk_trackIndex),
                    iInstrumentNumberFraction,
                    iNoteOnTime,
                    giDistanceDelaySynth_Duration,
                    iNoteNumber,
                    iVelocity,
                    iI))
                iI += 1
                iNoteOnTime += iI * giDistanceDelaySynth_DelayTime
                iInstrumentNumberFraction += 1
            od
            giDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = iInstrumentNumberFraction
            goto end
        endif

        iInstrumentNumberFraction = giDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX]
        iNoteOnTime = 0
        iI = 0
        while (iI < giDistanceDelaySynth_DelayCount) do
            SEvent = sprintf(
                "i %.6f %.03f %.3f %d %.3f %.3f %d",
                p1 + iInstrumentNumberFraction / 1000000,
                iNoteOnTime,
                giDistanceDelaySynth_Duration,
                EVENT_NOTE_GENERATED,
                iNoteNumber,
                iVelocity,
                iI)
            scoreline_i(SEvent)
            iI += 1
            iNoteOnTime += iI * giDistanceDelaySynth_DelayTime
            iInstrumentNumberFraction += 1
        od
        giDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = iInstrumentNumberFraction
#endif

    elseif (iEventType == EVENT_NOTE_GENERATED) then
        iNoteNumber = p5
        iVelocity = p6
        iDelayIndex = p7
        
        iAmp = (iVelocity / 127) * (1 - (iNoteNumber / 127))
        iCps = cpsmidinn(iNoteNumber)
        iCpsRandomized = iCps * random:i(0.999, 1.001)
        
        // Based on instrument Syn2 from "Interlocking Rhythms" by Steven Yi.
        // https://ide.csound.com/editor/8LFMLfAdH4kezFNEuii7

        ;; 6-OP FM
        asig = foscili(iAmp, iCps, 1, 1, expseg(2, 1, 0.1, 1, 0.001))
        asig += foscili(iAmp * ampdbfs(-18) * expon(1, 1, 0.001), iCps * 4, 1, 1, expseg(2, 1, 0.01, 1, 0.01))    
        asig += foscili(iAmp * ampdbfs(-30) * expon(1, .5, 0.001), iCps * 8, 1, 1, expseg(1, 1, 0.01, 1, 0.01))  
        
        asig *= expseg(0.01, 0.02, 1, .03, 0.5, p3 - .34, .4, 0.29, 0.001)
        
        ;; Filter
        ioct = octcps(iCpsRandomized)
        asig = K35_lpf(asig, cpsoct(expseg(min:i(14, ioct + 5), 1, ioct, 1, ioct)), 1, 1.5)  
        asig = K35_hpf(asig, iCpsRandomized, 0.5)    
        
        ;; Resonant Body
        ain = asig * ampdbfs(-60)
        
        a1 = mode(ain, 500, 20)
        a1 += mode(ain, 900, 10)  
        a1 += mode(ain, 1700, 6)    
        
        asig += a1

        ;; Declick
        asig *= linen:a(1, 0, p3, 0.001)
        
        iRadius = giDistanceDelaySynth_StartDistance + giDistanceDelaySynth_DelayDistance * iDelayIndex

        aSignals[][] init 3, 6
        kRotationIndex = 0
        while (kRotationIndex < 3) do
            kTheta = PI + (2 * PI / 3) * kRotationIndex
            kX = sin(kTheta) * iRadius
            kZ = cos(kTheta) * iRadius
            kY = 2

            kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
            kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giDistanceDelaySynth_ReferenceDistance, giDistanceDelaySynth_RolloffFactor)
            kDistanceAmp = min(kDistanceAmp, giDistanceDelaySynth_MaxAmpWhenVeryClose)
            #if IS_PLAYBACK
                kDistanceAmp *= giDistanceDelaySynth_PlaybackVolumeAdjustment
            #endif
            aOutDistanced = asig * kDistanceAmp

            AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
            iPlaybackReverbAdjustment init 1
            #if IS_PLAYBACK
                iPlaybackReverbAdjustment = giDistanceDelaySynth_PlaybackReverbAdjustment
            #endif

            aSignals[kRotationIndex][0] = gkAmbisonicChannelGains[0] * aOutDistanced
            aSignals[kRotationIndex][1] = gkAmbisonicChannelGains[1] * aOutDistanced
            aSignals[kRotationIndex][2] = gkAmbisonicChannelGains[2] * aOutDistanced
            aSignals[kRotationIndex][3] = gkAmbisonicChannelGains[3] * aOutDistanced
            aSignals[kRotationIndex][4] = asig * 2 * kDistanceAmp * iPlaybackReverbAdjustment
            aSignals[kRotationIndex][5] = aSignals[kRotationIndex][4]

            #if !IS_PLAYBACK
                kReloaded init false
                kFadeTimeLeft init 0.1
                if (gkReloaded == true) then
                    log_k_debug("Turning off instrument %.04f due to reload.", p1)
                    aEnvelope = linseg(1, 0.1, 0)
                    kReloaded = gkReloaded
                endif

                if (kReloaded == true) then
                    kFadeTimeLeft -= 1 / kr
                    if (kFadeTimeLeft <= 0) then
                        turnoff
                    endif
                endif
            #endif

            kRotationIndex += 1
        od

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + aSignals[0][0] + aSignals[1][0] + aSignals[2][0]
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + aSignals[0][1] + aSignals[1][1] + aSignals[2][1]
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + aSignals[0][2] + aSignals[1][2] + aSignals[2][2]
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + aSignals[0][3] + aSignals[1][3] + aSignals[2][3]
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aSignals[0][4] + aSignals[1][4] + aSignals[2][4]
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aSignals[0][5] + aSignals[1][5] + aSignals[2][5]
        #else
            kReloaded init false
            kFadeTimeLeft init 0.1
            if (gkReloaded == true) then
                log_k_debug("Turning off instrument %.04f due to reload.", p1)
                aEnvelope = linseg(1, 0.1, 0)
                kReloaded = gkReloaded
            endif
            outc(
                aSignals[0][0], aSignals[1][0], aSignals[2][0],
                aSignals[0][1], aSignals[1][1], aSignals[2][1],
                aSignals[0][2], aSignals[1][2], aSignals[2][2],
                aSignals[0][3], aSignals[1][3], aSignals[2][3],
                aSignals[0][4], aSignals[1][4], aSignals[2][4],
                aSignals[0][5], aSignals[1][5], aSignals[2][5])
        #endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (iDelayIndex == 0) then
                if (giDistanceDelaySynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                    scoreline_i("i \"DistanceDelaySynth_Json\" 0 0")
                endif
                giDistanceDelaySynth_NoteIndex[ORC_INSTANCE_INDEX] = giDistanceDelaySynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
                SJsonFile = sprintf("json/%s.%d.json", INSTRUMENT_PLUGIN_UUID, giDistanceDelaySynth_NoteIndex[ORC_INSTANCE_INDEX])
                fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f,\"note\":%d,\"velocity\":%d}}",
                    times(), iNoteNumber, iVelocity)
                ficlose(SJsonFile)
            endif
        ${CSOUND_ENDIF}
    endif
end:
endin


#if IS_PLAYBACK
    instr CONCAT(Preallocate_, INSTRUMENT_ID)
        ii = 0
        iCount = giPresetUuidPreallocationCount[INSTRUMENT_TRACK_INDEX]
        while (ii < iCount) do
            scoreline_i(sprintf("i %d.%.3d 0 1 %d 1 1 0",
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
