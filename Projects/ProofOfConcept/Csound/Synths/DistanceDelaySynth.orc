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

giDistanceDelaySynth_StartDistance = 60
giDistanceDelaySynth_DelayDistance = 100
giDistanceDelaySynth_NoteNumberToHeightScale = 5
giDistanceDelaySynth_DelayTime = 0.5 // seconds
giDistanceDelaySynth_Duration = 0.49 // seconds
giDistanceDelaySynth_DelayCount = 5
giDistanceDelaySynth_MaxAmpWhenVeryClose = 0.5
giDistanceDelaySynth_ReferenceDistance = 2
giDistanceDelaySynth_RolloffFactor = 0.125
giDistanceDelaySynth_PlaybackVolumeAdjustment = 2.5
giDistanceDelaySynth_PlaybackReverbAdjustment = 0.25

giDistanceDelaySynth_NoteIndex[] init ORC_INSTANCE_COUNT
giDistanceDelaySynth_InstrumentNumberFraction[] init ORC_INSTANCE_COUNT

${CSOUND_IFNDEF} DISTANCE_DELAY_SYNTH_NOTE_CACHE_ARRAY
    ${CSOUND_DEFINE} DISTANCE_DELAY_SYNTH_NOTE_CACHE_ARRAY #init 1#
${CSOUND_ENDIF}

${CSOUND_IFNDEF} DISTANCE_DELAY_SYNTH_LOWEST_NOTE_NUMBER
    ${CSOUND_DEFINE} DISTANCE_DELAY_SYNTH_LOWEST_NOTE_NUMBER #0#
${CSOUND_ENDIF}

giDistanceDelaySynth_LowestNoteNumber = $DISTANCE_DELAY_SYNTH_LOWEST_NOTE_NUMBER
giDistanceDelaySynth_SampleCacheNoteNumbers[] $DISTANCE_DELAY_SYNTH_NOTE_CACHE_ARRAY
giDistanceDelaySynth_SampleCacheTableNumbers[] init lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)
giDistanceDelaySynth_SampleCacheLength init sr * giDistanceDelaySynth_Duration
giDistanceDelaySynth_SampleCacheTableLength = 2
while (giDistanceDelaySynth_SampleCacheTableLength < giDistanceDelaySynth_SampleCacheLength) do
    giDistanceDelaySynth_SampleCacheTableLength *= 2
od
; prints("giDistanceDelaySynth_SampleCacheTableLength = %d\n", giDistanceDelaySynth_SampleCacheTableLength)

iI = 0
while (iI < lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)) do
    // Generate empty tables to hold each note's sample cache.
    giDistanceDelaySynth_SampleCacheTableNumbers[iI] = ftgen(0, 0, giDistanceDelaySynth_SampleCacheTableLength, 2, 0)
    iI += 1
od

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
        fprints(SJsonFile, sprintf(",\"noteNumberToHeightScale\":%.02f", giDistanceDelaySynth_NoteNumberToHeightScale))
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

    elseif (iEventType == EVENT_NOTE_GENERATED || iEventType == EVENT_NOTE_CACHE) then
        iNoteNumber = p5
        iVelocity = p6
        iDelayIndex = p7

        iSampleCacheI = -1
        iI = 0
        while (iI < lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)) do
            if (iNoteNumber == giDistanceDelaySynth_SampleCacheNoteNumbers[iI]) then
                iSampleCacheI = iI
                iI = lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers) // kick out of while loop
            endif
            iI += 1
        od
        if (iSampleCacheI == -1 || iSampleCacheI == lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)) then
            log_i_warning("Sample cache for note number %d not found", iNoteNumber)
            turnoff
        endif
        ; prints("iNoteNumber = %d, iSampleCacheI = %d\n", iNoteNumber, iSampleCacheI)

        #if IS_PLAYBACK
            iIsPlayback = true
        #else
            iIsPlayback = false
        #endif

        a1 init 0
        asig init 0

        if(iIsPlayback == false || iEventType == EVENT_NOTE_CACHE) then
            iAmp init 0
            if (iIsPlayback == false) then
                iAmp = (iVelocity / 127) * (1 - (iNoteNumber / 127))
            else
                iAmp = 1
            endif
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

            ;; Declick
            asig *= linen:a(1, 0, p3, 0.001)

            asig += a1

            if (iEventType == EVENT_NOTE_CACHE) then
                ; prints("Copying asig into note's sample cache table.\n")
                // Copy `asig` into note's sample cache table at sample offset `kPass` * ksmps.
                kPass init 0
                kDummy = tablewa(giDistanceDelaySynth_SampleCacheTableNumbers[iSampleCacheI], asig, kPass * ksmps)
                kPass += 1
                goto end
            endif
        endif

        if (iIsPlayback == true && iSampleCacheI >= 0) then
            // Read `asig` from note's sample cache.
            ; prints("table length = %d\n", ftlen(giDistanceDelaySynth_SampleCacheTableNumbers[iSampleCacheI]))
            asig = oscil(1, 1, giDistanceDelaySynth_SampleCacheTableNumbers[iSampleCacheI])
        endif

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
        
        kY init (iNoteNumber - giDistanceDelaySynth_LowestNoteNumber) * giDistanceDelaySynth_NoteNumberToHeightScale
        iRadius = giDistanceDelaySynth_StartDistance + giDistanceDelaySynth_DelayDistance * iDelayIndex
        kRotationIndex = 0
        while (kRotationIndex < 3) do
            kTheta = PI + (2 * PI / 3) * kRotationIndex
            kX = sin(kTheta) * iRadius
            kZ = cos(kTheta) * iRadius

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

            a1 += gkAmbisonicChannelGains[0] * aOutDistanced
            a2 += gkAmbisonicChannelGains[1] * aOutDistanced
            a3 += gkAmbisonicChannelGains[2] * aOutDistanced
            a4 += gkAmbisonicChannelGains[3] * aOutDistanced
            a5 += asig * 2 * kDistanceAmp * iPlaybackReverbAdjustment

            kRotationIndex += 1
        od

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

    instr CONCAT(FillSampleCache_, INSTRUMENT_ID)
        iI = 0
        while (iI < lenarray(giDistanceDelaySynth_SampleCacheNoteNumbers)) do
            prints("Filling DistanceDelaySynth sample cache for note %d\n", giDistanceDelaySynth_SampleCacheNoteNumbers[iI])
            scoreline_i(sprintf(
                "i %d 0 %f %d %d 127 0",
                INSTRUMENT_ID,
                giDistanceDelaySynth_Duration,
                EVENT_NOTE_CACHE,
                giDistanceDelaySynth_SampleCacheNoteNumbers[iI]))
            iI += 1
        od
        turnoff
    endin
    scoreline_i(sprintf("i \"FillSampleCache_%d\" 0 -1", INSTRUMENT_ID))
#endif

//----------------------------------------------------------------------------------------------------------------------
