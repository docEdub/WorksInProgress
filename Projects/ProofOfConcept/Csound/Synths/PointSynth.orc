#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: PointSynth.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef PointSynth_orc__include_guard
#define PointSynth_orc__include_guard

${CSOUND_INCLUDE} "adsr_linesegr.udo.orc"

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

giMaxDistance = 100
giMinDistance = 5
giMinDistanceAttenuation = AF_3D_Audio_DistanceAttenuation_i(0, giMinDistance, giMaxDistance)


instr PointSynth_CcEvent
    iCcType = p4
    iCcValue = p5
    iOrcInstanceIndex = p6
endin

instr PointSynth_Note
    iPitch = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7
    aOut = poscil(0.01, cpsmidinn(iPitch))
    outch(1, aOut)
endin

giPointSynthCcEventInstrumentNumber = nstrnum("PointSynth_CcEvent")
giPointSynthNoteInstrumentNumber = nstrnum("PointSynth_Note")

// [i][j]: i = .orc instance, j = MIDI note number. Stored value is note's velocity.
gkPointSynthActiveNotes[][] init ORC_INSTANCE_COUNT, 128

#endif // #ifndef PointSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

instr INSTRUMENT_ID
    log_i_debug("%.3f ...", p1)

    iEventType = p4
    if (iEventType == EVENT_CC) then
        aUnused subinstr giPointSynthCcEventInstrumentNumber, p5, p6, ORC_INSTANCE_INDEX
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        aOut = poscil(0.01, cpsmidinn(p5))

        iFadeInTime init 0.125
        iFadeOutTime init 0.125
        aEnvelope = adsr_linsegr(iFadeInTime, 0, 1, iFadeOutTime)
        aOut *= aEnvelope
        
        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aOut
        #else
            kReloaded init false
            kFadeTimeLeft init iFadeInTime
            if (gkReloaded == true) then
                log_k_debug("Turning off instrument %.04f due to reload.", p1)
                aEnvelope = linseg(1, iFadeOutTime, 0)
                kReloaded = gkReloaded
            endif

            outc(aOut, aOut, aOut, aOut, aOut, aOut)

            if (kReloaded == true) then
                kFadeTimeLeft -= 1 / kr
                if (kFadeTimeLeft <= 0) then
                    turnoff
                endif
            endif
        #endif
    endif

    log_i_info("%.3f - done", p1)
endin

//----------------------------------------------------------------------------------------------------------------------
