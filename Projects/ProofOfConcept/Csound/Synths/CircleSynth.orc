#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: CircleSynth.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef CircleSynth_orc__include_guard
#define CircleSynth_orc__include_guard

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

giCircleSynth_DistanceMin = 5
giCircleSynth_DistanceMax = 100

instr CircleSynth_NoteOn
    iNoteNumber = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7

    log_i_info("CircleSynth_NoteOn ...")

    aOut = 0

    kPosition[] fillarray 0, 0, 0
    kSourceDistance = AF_3D_Audio_SourceDistance(kPosition)
    kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, k(giCircleSynth_DistanceMin), k(giCircleSynth_DistanceMax))
    aOutDistanced = aOut * kDistanceAttenuation
    aOut = aOut * (2 * kDistanceAttenuation)
    kAmbisonicChannelGains[] = AF_3D_Audio_ChannelGains(kPosition, 1)
    a1 = kAmbisonicChannelGains[0] * aOutDistanced
    a2 = kAmbisonicChannelGains[1] * aOutDistanced
    a3 = kAmbisonicChannelGains[2] * aOutDistanced
    a4 = kAmbisonicChannelGains[3] * aOutDistanced
    outch(1, a1, 2, a2, 3, a3, 4, a4, 5, aOut)
    
    log_i_trace("CircleSynth_NoteOn - done")
endin:
endin

instr CircleSynth_NoteOff
    iNoteNumber = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7
endin

giCircleSynthNoteInstrumentNumber = nstrnum("CircleSynth_NoteOn")

#endif // #ifndef CircleSynth_orc__include_guard

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

        a1, a2, a3, a4, aOut subinstr giCircleSynthNoteInstrumentNumber,
            iNoteNumber,
            iVelocity,
            ORC_INSTANCE_INDEX,
            INSTRUMENT_TRACK_INDEX

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + a2
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + a3
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + a4
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aOut
        #else
            outch(1, a1)
            outch(2, a2)
            outch(3, a3)
            outch(4, a4)
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
