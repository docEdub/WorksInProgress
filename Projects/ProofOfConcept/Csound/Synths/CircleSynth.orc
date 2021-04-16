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

#define CIRCLE_SYNTH_HEIGHT_MIN 1
#define CIRCLE_SYNTH_HEIGHT_MAX 50
#define CIRCLE_SYNTH_RADIUS_MIN 1
#define CIRCLE_SYNTH_RADIUS_MAX 50
#define CIRCLE_SYNTH_SPREAD_SPEED_MIN 10 // degrees per second.
#define CIRCLE_SYNTH_SPREAD_SPEED_MAX 180 // degrees per second.
#define CIRCLE_SYNTH_NOTE_NUMBER_MIN 60
#define CIRCLE_SYNTH_NOTE_NUMBER_MAX 96

giCircleSynth_HeightRange init CIRCLE_SYNTH_HEIGHT_MAX - CIRCLE_SYNTH_HEIGHT_MIN
giCircleSynth_RadiusRange init CIRCLE_SYNTH_RADIUS_MAX - CIRCLE_SYNTH_RADIUS_MIN
giCircleSynth_SpreadSpeedRange init CIRCLE_SYNTH_SPREAD_SPEED_MAX - CIRCLE_SYNTH_SPREAD_SPEED_MIN
giCircleSynth_NoteNumberRange init CIRCLE_SYNTH_NOTE_NUMBER_MAX - CIRCLE_SYNTH_NOTE_NUMBER_MIN

giCircleSynth_DistanceMin = 5
giCircleSynth_DistanceMax = 100

instr CircleSynth_NoteOn
    iNoteNumber = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7

    log_i_trace("CircleSynth_NoteOn ...")

    iSecondsPerKPass = 1 / kr
    kPass init -1
    kPass += 1

    if (iNoteNumber < CIRCLE_SYNTH_NOTE_NUMBER_MIN || iNoteNumber > CIRCLE_SYNTH_NOTE_NUMBER_MAX) then
        log_i_warning("Note number %d not in range [%d, %d]", iNoteNumber, CIRCLE_SYNTH_NOTE_NUMBER_MIN,
            CIRCLE_SYNTH_NOTE_NUMBER_MAX)
        goto endin
    endif

    iNoteNumberNormalized init (iNoteNumber - CIRCLE_SYNTH_NOTE_NUMBER_MIN) / giCircleSynth_NoteNumberRange
    iHeight init CIRCLE_SYNTH_HEIGHT_MIN + giCircleSynth_HeightRange * iNoteNumberNormalized
    iRadius init CIRCLE_SYNTH_RADIUS_MAX - giCircleSynth_RadiusRange * iNoteNumberNormalized
    log_i_debug("iNoteNumberNormalized = %f, iHeight = %f, iRadius = %f", iNoteNumberNormalized, iHeight, iRadius)

    iSpreadIncrement init iSecondsPerKPass * (CIRCLE_SYNTH_SPREAD_SPEED_MIN + iVelocity *
        giCircleSynth_SpreadSpeedRange)
    kSpread init 1 - iSpreadIncrement
    kSpread = min(kSpread + iSpreadIncrement, 360)
    //log_k_debug("%d: kSpread = %f", kPass, kSpread)    

    aOut = 0

    kPosition[] fillarray 0, 0, 0
    kSourceDistance = AF_3D_Audio_SourceDistance(kPosition)
    kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, k(giCircleSynth_DistanceMin),
        k(giCircleSynth_DistanceMax))
    aOutDistanced = aOut * kDistanceAttenuation
    aOut = aOut * (2 * kDistanceAttenuation)
    kAmbisonicChannelGains[] = AF_3D_Audio_ChannelGains(kPosition, kSpread)
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
                log_k_trace("Turning off instrument %.04f due to reload.", p1)
                turnoff
            endif
        #endif
    endif
endin:
endin

//----------------------------------------------------------------------------------------------------------------------
