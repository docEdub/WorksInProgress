#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Triangle1Synth.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef Triangle1Synth_orc__include_guard
#define Triangle1Synth_orc__include_guard

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

giTriangle1Synth_MaxAmpWhenVeryClose = 1
giTriangle1Synth_ReferenceDistance = 0.1
giTriangle1Synth_RolloffFactor = 0.005
giTriangle1Synth_PlaybackVolumeAdjustment = 0.9
giTriangle1Synth_PlaybackReverbAdjustment = 1.5

giTriangle1Synth_NoteIndex[] init ORC_INSTANCE_COUNT

#endif // #ifndef Triangle1Synth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr Triangle1Synth_Json
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
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
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

        iNoteNumber = p5
        iVelocity = p6
        iCps = cpsmidinn(iNoteNumber)
        kAmp = 0.1 * (iVelocity / 127)
        a1 = vco2(kAmp, iCps, VCO2_WAVEFORM_TRIANGLE_NO_RAMP)

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = a1
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
            outc(a1, a1, a1, a1, a1, a1)
        #endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"Triangle1Synth_Json\" 0 0")
            endif
            giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX] = giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giTriangle1Synth_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f}}", times())
            ficlose(SJsonFile)
        ${CSOUND_ENDIF}
    endif
end:
endin

//----------------------------------------------------------------------------------------------------------------------
