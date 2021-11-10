#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: TR_808.orc
//
// Description:
//  Single triangle wave oscillator with piano-like decay.
//
// Based on Iain McCurdy's .csd. See http://iainmccurdy.org/csound.html.
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef TR_808_orc__include_guard
#define TR_808_orc__include_guard

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


#define TR_808_BASS_DRUM_KEY 37 // C#3
#define TR_808_SNARE_DRUM_KEY 39 // D#3
#define TR_808_RIM_SHOT_KEY 40 // E3

#define TR_808_LOW_TOM_KEY 42 // F#3
#define TR_808_MID_TOM_KEY 44 // G#3
#define TR_808_HIGH_TOM_KEY 46 // A#4

#define TR_808_CLOSED_HIGH_HAT_KEY 49 // C#4
#define TR_808_OPEN_HIGH_HAT_KEY 51 // D#4

#define TR_808_CYMBAL_KEY 54 // F#4
#define TR_808_COWBELL_KEY 56 // G#4
#define TR_808_CLAP_KEY 58 // A#5

#define TR_808_CLAVES_KEY 61 // C#5
#define TR_808_MARACA_KEY 63 // D#5

#define TR_808_LOW_CONGA_KEY 66 // F#5
#define TR_808_MID_CONGA_KEY 68 // G#5
#define TR_808_HIGH_CONGA_KEY 70 // A#6


giTR_808_MaxAmpWhenVeryClose = 1
giTR_808_ReferenceDistance = 0.1
giTR_808_RolloffFactor = 0.005
giTR_808_PlaybackVolumeAdjustment = 1
giTR_808_PlaybackReverbAdjustment = 1

giTR_808_NoteIndex[] init ORC_INSTANCE_COUNT

giTR_808_Sine_TableNumber = ftgen(0, 0, 1024, 10, 1)
giTR_808_Cosine_TableNumber = ftgen(0, 0, 65536, 9, 1, 1, 90)


#endif // #ifndef TR_808_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr TR_808_Json
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
        iNoteNumber = p5
        iVelocity = p6

        a1 init 0

        // Map velocity [0, 127] to dB [-30, 0] and adjust for 0dbfs = 1.
        iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)

        log_i_debug("iNoteNumber == %d", iNoteNumber)

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
            if (giTR_808_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"TR_808_Json\" 0 0")
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

//----------------------------------------------------------------------------------------------------------------------
