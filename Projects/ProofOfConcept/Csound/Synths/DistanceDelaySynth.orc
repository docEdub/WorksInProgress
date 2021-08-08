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

giDistanceDelaySynth_DelayTime = 1 // second
giDistanceDelaySynth_DelayCount = 5
giDistanceDelaySynth_DistanceMin = 1
giDistanceDelaySynth_DistanceMax = 50
giDistanceDelaySynth_ReferenceDistance = 5
giDistanceDelaySynth_RolloffFactor = 1
giDistanceDelaySynth_PlaybackVolumeAdjustment = 10
giDistanceDelaySynth_PlaybackReverbAdjustment = 0.5

giDistanceDelaySynth_NoteIndex[] init ORC_INSTANCE_COUNT
gkDistanceDelaySynth_InstrumentNumberFraction[] init ORC_INSTANCE_COUNT

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

        gkDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = gkDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] + 1
        if (gkDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] == 1000) then
            gkDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = 1
        endif
        kInstrumentNumberFraction = gkDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX]

        if (i(gk_mode) == 4) then
            // Skip to end if track index is -1 due to mode switch lag.
            if (gk_trackIndex == -1) kgoto end

            kNoteOnTime = elapsedTime_k()
            kI = 0
            while (kI < giDistanceDelaySynth_DelayCount) do
                sendScoreMessage_k(sprintfk(
                    "i  CONCAT(%s_%d, .%03d) %.03f %.03f EVENT_NOTE_GENERATED Note(%d) Velocity(%d)",
                    STRINGIZE(${InstrumentName}),
                    gk_trackIndex,
                    kInstrumentNumberFraction,
                    kNoteOnTime,
                    giTotalTime,
                    kNoteNumber,
                    kVelocity))
                kI += 1
                kNoteOnTime += giDistanceDelaySynth_DelayTime
                kInstrumentNumberFraction += 1
            od
            gkDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = kInstrumentNumberFraction
            goto end
        endif

        kInstrumentNumberFraction = gkDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX]
        kNoteOnTime = 0
        kI = 0
        while (kI < giDistanceDelaySynth_DelayCount) do
            SEvent = sprintfk(
                "i %.6f %.03f %.2f %d %.3f %.3f %d",
                p1 + kInstrumentNumberFraction / 1000000,
                kNoteOnTime,
                giTotalTime,
                p4,
                kNoteNumber,
                kVelocity,
                kI)
            scoreline(SEvent, 1)
            kI += 1
            knoteOnTime += giDistanceDelaySynth_DelayTime
            kInstrumentNumberFraction += 1
        od
        gkDistanceDelaySynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = kInstrumentNumberFraction
#endif

    elseif (iEventType == EVENT_NOTE_GENERATED) then
        iNoteNumber = p5
        iVelocity = p6
        iDelayIndex = p7
        
        iAmp = iVelocity / 127
        iCps = cpsmidinn(iNoteNumber)
        iCpsRandomized = iCps * random:i(0.999, 1.001)
        
        ;; 6-OP FM
        asig = foscili(iCps, iAmp, 1, 1, expseg(2, 1, 0.1, 1, 0.001))
        asig += foscili(iCps * ampdbfs(-18) * expon(1, 1, 0.001), iAmp * 4, 1, 1, expseg(2, 1, 0.01, 1, 0.01))    
        asig += foscili(iCps * ampdbfs(-30) * expon(1, .5, 0.001), iAmp * 8, 1, 1, expseg(1, 1, 0.01, 1, 0.01))  
        
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
        
        ;; Mix
        // TODO: Use iNoteNumber to determine theta.
        // TODO: Use iDelayIndex to determine radius.
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
