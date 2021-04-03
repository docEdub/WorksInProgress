#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: TableSynth.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef TableSynth_orc__include_guard
#define TableSynth_orc__include_guard

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

instr TableSynth_NoteOn
    iNoteNumber = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7

    log_i_info("TableSynth_NoteOn ...")

    // Max amount of seconds to keep rising. The riser table is exponentional. It rises slower and slower as time
    // pass, and eventually maxes out at 1. When the max rise time is exceeded, the riser value stays at 1.
    iMaxRiseTime = 20

    iMaxRiseAmount = 12 // 1 octave

    // The amount of "wobble" the pitch will have as it rises.
    iNoteNumberWobbleAmount = 0.333

    // The speed of the pitch "wobble" LFO in hertz.
    iNoteNumberWobbleSpeed = 5

    iRiserTableSize = 1024
    iWobbleTableSize = 1024

    iSecondsPerKPass = 1 / kr
    
    // Exponential curve from 0 to 1, slowing when approaching 1.
    iRiserTableId = ftgenonce(0, 0, iRiserTableSize, 16, 0, iRiserTableSize, -10, 1)

    iRiserTableIncrement_i = iSecondsPerKPass * (iRiserTableSize / iMaxRiseTime)
    kRiserTable_i init 0
    if (kRiserTable_i < iWobbleTableSize) then
        kRiserTable_i += iRiserTableIncrement_i
    endif

    // 1 cycle of a sine wave.
    iWobbleTableId = ftgenonce(0, 0, 1024, 10, 1)

    iWobbleTableIncrement_i = iNoteNumberWobbleSpeed * (iSecondsPerKPass * iWobbleTableSize)
    log_i_info("iWobbleTableIncrement_i = %f", iWobbleTableIncrement_i)
    kWobbleTable_i init 0
    kWobbleTable_i += iWobbleTableIncrement_i
    kWobbleTable_i = kWobbleTable_i % iWobbleTableSize

    kNoteNumber = iNoteNumber
    kNoteNumber += tablei(kRiserTable_i, iRiserTableId) * iMaxRiseAmount
    kNoteNumber += tablei(kWobbleTable_i, iWobbleTableId) * iNoteNumberWobbleAmount
    if (kNoteNumber > 127) then
        kNoteNumber = 127
        #ifdef LOGGING
            kLoggedNoteNumberWarning init false
            if (kLoggedNoteNumberWarning == false) then
                log_k_warning("Note number limited to 127 (kNoteNumber = %f.", kNoteNumber)
                kLoggedNoteNumberWarning = true
            endif
    else
            kLoggedNoteNumberWarning = false
        #endif
    endif

    iAmp = 0.01 * iVelocity
    kCps = cpsmidinn(kNoteNumber)
    aOut = vco2(iAmp, kCps, 10, 0.5, 0, 0.1) // square wave: NB 0.25 fattens it up
    aOut = tone(aOut, 5000)
    out aOut

    log_i_trace("TableSynth_NoteOn - done")
endin

instr TableSynth_NoteOff
    iNoteNumber = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7
endin

giTableSynthNoteInstrumentNumber = nstrnum("TableSynth_NoteOn")

#endif // #ifndef TableSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

instr INSTRUMENT_ID

    iEventType = p4
    if (iEventType == EVENT_CC) then
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        iNoteNumber = p5
        iVelocity = p6

        iInstrumentNumber = p1 + 0.0001
        SOnEvent = sprintf("i %.4f 0 -1 %d %d %d", iInstrumentNumber, EVENT_NOTE_GENERATED, iNoteNumber, iVelocity)
        scoreline_i(SOnEvent)

        kReleased = release()
        if (kReleased == true) then
            SOffEvent = sprintfk("i -%.4f 0 1", iInstrumentNumber)
            scoreline(SOffEvent, 1)
            turnoff
        endif
    elseif (iEventType == EVENT_NOTE_GENERATED) then
        iNoteNumber = p5
        iVelocity = p6

        aOut subinstr giTableSynthNoteInstrumentNumber,
            iNoteNumber,
            iVelocity,
            ORC_INSTANCE_INDEX,
            INSTRUMENT_TRACK_INDEX

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aOut
        #else
            outch(1, aOut)
            outch(2, aOut)
            outch(3, aOut)
            outch(4, aOut)
            outch(5, aOut)
            outch(6, aOut)

            if (gkReloaded == true) then
                log_k_debug("Turning off instrument %.04f due to reload.", p1)
                turnoff
            endif
        #endif
    endif
endin:
endin

//----------------------------------------------------------------------------------------------------------------------
