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

giDistanceDelaySynth_DelayTime = 0.333 // second
giDistanceDelaySynth_DelayCount = 20
giDistanceDelaySynth_DistanceMin = 1
giDistanceDelaySynth_DistanceMax = 50
giDistanceDelaySynth_ReferenceDistance = 5
giDistanceDelaySynth_RolloffFactor = 1
giDistanceDelaySynth_PlaybackVolumeAdjustment = 10
giDistanceDelaySynth_PlaybackReverbAdjustment = 0.5
giDistanceDelaySynth_Duration = 0.5

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
        fprints(SJsonFile, sprintf(",\"delayTime\":%.02f", giDistanceDelaySynth_DelayTime))
        fprints(SJsonFile, sprintf(",\"delayCount\":%.02f", giDistanceDelaySynth_DelayCount))
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
                    "i  CONCAT(%s_%d, .%03d) %.03f %.03f EVENT_NOTE_GENERATED Note(%d) Velocity(%d)",
                    STRINGIZE(${InstrumentName}),
                    i(gk_trackIndex),
                    iInstrumentNumberFraction,
                    iNoteOnTime,
                    giDistanceDelaySynth_Duration,
                    iNoteNumber,
                    iVelocity))
                iI += 1
                iNoteOnTime += giDistanceDelaySynth_DelayTime
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
            iNoteOnTime += giDistanceDelaySynth_DelayTime
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
        
        iTheta = (iNoteNumber / 127) * (1.5 * PI)
        iRadius = 50 + 50 * iDelayIndex
        iX = iRadius * sin(iTheta)
        iZ = iRadius * cos(iTheta)
        iY = 2

        kDistance = AF_3D_Audio_SourceDistance(iX, iY, iZ)
        kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giDistanceDelaySynth_ReferenceDistance, giDistanceDelaySynth_RolloffFactor)
        #if IS_PLAYBACK
            kDistanceAmp *= giDistanceDelaySynth_PlaybackVolumeAdjustment
        #endif
        aOutDistanced = asig * kDistanceAmp

        AF_3D_Audio_ChannelGains_XYZ(k(iX), k(iY), k(iZ))
        a1 = gkAmbisonicChannelGains[0] * aOutDistanced
        a2 = gkAmbisonicChannelGains[1] * aOutDistanced
        a3 = gkAmbisonicChannelGains[2] * aOutDistanced
        a4 = gkAmbisonicChannelGains[3] * aOutDistanced
        aReverbOut = asig * 2 * kDistanceAmp

        #if IS_PLAYBACK
            aReverbOut *= giDistanceDelaySynth_PlaybackReverbAdjustment
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
                aEnvelope = linseg(1, 0.1, 0)
                kReloaded = gkReloaded
            endif

            outc(a1, a2, a3, a4, aReverbOut, aReverbOut)

            if (kReloaded == true) then
                kFadeTimeLeft -= 1 / kr
                if (kFadeTimeLeft <= 0) then
                    turnoff
                endif
            endif
        #endif
    endif
end:
endin


#if IS_PLAYBACK
    instr CONCAT(Preallocate_, INSTRUMENT_ID)
        ii = 0
        while (ii < giPresetUuidPreallocationCount[INSTRUMENT_TRACK_INDEX]) do
            scoreline_i(sprintf("i %d.%.3d 0 .1 %d 1 1", INSTRUMENT_ID, ii, EVENT_NOTE_ON))
            ii += 1
        od
        turnoff
    endin
    scoreline_i(sprintf("i \"Preallocate_%d\" 0 -1", INSTRUMENT_ID))
#endif

//----------------------------------------------------------------------------------------------------------------------
