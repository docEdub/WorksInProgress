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

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    "example",                                  "bool",     "false",            "synced", _(\)
_(\)
    "",                                         "",         "",                 "") // dummy line

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
endin

giPointSynthCcEventInstrumentNumber = nstrnum("PointSynth_CcEvent")
giPointSynthNoteInstrumentNumber = nstrnum("PointSynth_Note")

#endif // #ifndef PointSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

instr INSTRUMENT_ID
    iEventType = p4
    if (iEventType == EVENT_CC) then
        aUnused subinstr giPointSynthCcEventInstrumentNumber, p5, p6, ORC_INSTANCE_INDEX
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        ao1, ao2, ao3, ao4, ao5, ao6 subinstr giPointSynthNoteInstrumentNumber, p5, p6, ORC_INSTANCE_INDEX,
            INSTRUMENT_TRACK_INDEX

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = ao1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = ao2
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = ao3
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = ao4
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = ao5
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = ao6
        #else
            outch(1, ao1)
            outch(2, ao2)
            outch(3, ao3)
            outch(4, ao4)
            outch(5, ao5)
            outch(6, ao6)
        #endif
    endif
endin

//----------------------------------------------------------------------------------------------------------------------
