#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Triangle2Synth.orc
//
// Description:
//  Single triangle wave oscillator with piano-like decay and 2 note number LFOs.
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef Triangle2Synth_orc__include_guard
#define Triangle2Synth_orc__include_guard

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
${CSOUND_INCLUDE} "time.orc"

giTriangle2Synth_MaxAmpWhenVeryClose = 1
giTriangle2Synth_ReferenceDistance = 0.1
giTriangle2Synth_RolloffFactor = 0.005
giTriangle2Synth_PlaybackVolumeAdjustment = 0.9
giTriangle2Synth_PlaybackReverbAdjustment = 1.5

giTriangle2Synth_NoteIndex[] init ORC_INSTANCE_COUNT

#endif // #ifndef Triangle2Synth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr Triangle2Synth_Json
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, "}")
        turnoff
    endin
${CSOUND_ENDIF}


gkNoteNumberLfo init 0

instr CONCAT(INSTRUMENT_ID, _GlobalNoteNumberLfo)
    log_i_trace("%s ...", nstrstr(p1))

    gkNoteNumberLfo = lfo(33, .03, LFO_SHAPE_TRIANGLE)

    #if !IS_PLAYBACK
        if (gkReloaded == true) then
            event("i", STRINGIZE(CONCAT(INSTRUMENT_ID, _GlobalNoteNumberLfo)), 0, -1)
            turnoff
        endif
    #endif

    ; #if LOGGING
    ;     kLastTime init 0
    ;     kTime = time_k()
    ;     if (kTime - kLastTime > 1) then
    ;         kLastTime = kTime
    ;         log_k_trace("%s running ...", nstrstr(p1))
    ;     endif
    ; #endif

    log_i_trace("%s - done", nstrstr(p1))
endin

event_i("i", STRINGIZE(CONCAT(INSTRUMENT_ID, _GlobalNoteNumberLfo)), 0, -1)


instr INSTRUMENT_ID
    iEventType = p4
    if (iEventType == EVENT_CC) then
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then


        // Oscillator
        //--------------------------------------------------------------------------------------------------------------
        iNoteNumber = p5
        iVelocity = p6
        kAmp = 0.333 * (iVelocity / 127)

        kNoteNumber init iNoteNumber

        kNoteNumberLfo init 0
        kNoteNumberLfo = lfo(0.333, gkNoteNumberLfo, LFO_SHAPE_TRIANGLE)
        kCps = cpsmidinn(kNoteNumber + kNoteNumberLfo)
        a1 = vco2(kAmp, kCps, VCO2_WAVEFORM_TRIANGLE_NO_RAMP)

        // Volume envelope
        //--------------------------------------------------------------------------------------------------------------
        iEnvelopeA = 0.01
        iEnvelopeD = 0.1
        iEnvelopeS = 0.667
        iEnvelopeR = 0.1

        iEnvelopeS_decayTime = 0.333 + 33 * (1 - iNoteNumber / 127)
        iEnvelopeS_decayAmountMinimum = 0.001 * (1 - iNoteNumber / 127)

        #if IS_PLAYBACK
            a1 *= xadsr:a(iEnvelopeA, iEnvelopeD, iEnvelopeS, iEnvelopeR)
        #else
            a1 *= mxadsr:a(iEnvelopeA, iEnvelopeD, iEnvelopeS, iEnvelopeR)
        #endif

        iEnvelopeS_decayStartTime = p2 + iEnvelopeA + iEnvelopeD
        iEnvelopeS_decayEndTime = iEnvelopeS_decayStartTime + iEnvelopeS_decayTime
        aEnvelopeS_decayAmount init 1
        kTime = time_k()
        if (kTime >= iEnvelopeS_decayStartTime && kTime < iEnvelopeS_decayEndTime) then
            aEnvelopeS_decayAmount = expon(1, iEnvelopeS_decayTime, iEnvelopeS_decayAmountMinimum)
        endif
        a1 *= aEnvelopeS_decayAmount

        // Low pass filter
        //--------------------------------------------------------------------------------------------------------------
        a1 = tone(a1, 999 + 333)


        #if IS_PLAYBACK
            ; gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = a1
            ; gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = a1
            ; gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = a1
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
            outc(a(0), a(0), a(0), a1, a1, a1)
        #endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"Triangle2Synth_Json\" 0 0")
            endif
            giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX] = giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giTriangle2Synth_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f}}", times())
            ficlose(SJsonFile)
        ${CSOUND_ENDIF}
    endif
end:
endin

//----------------------------------------------------------------------------------------------------------------------
