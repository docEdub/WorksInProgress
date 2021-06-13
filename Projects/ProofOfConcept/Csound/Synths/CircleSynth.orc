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

#define CIRCLE_SYNTH_HEIGHT_MIN 1
#define CIRCLE_SYNTH_HEIGHT_MAX 50
#define CIRCLE_SYNTH_RADIUS_MIN 1
#define CIRCLE_SYNTH_RADIUS_MAX 50
#define CIRCLE_SYNTH_SPREAD_MAX 260
#define CIRCLE_SYNTH_SPREAD_SPEED_MIN 1 // degrees per second.
#define CIRCLE_SYNTH_SPREAD_SPEED_MAX 15 // degrees per second.
#define CIRCLE_SYNTH_NOTE_NUMBER_MIN 24
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

    iCps = cpsmidinn(iNoteNumber)
    iLowPassCutoffBase = iCps * 16
    iLowPassCutoffBaseOver360 = iLowPassCutoffBase / CIRCLE_SYNTH_SPREAD_MAX

    iNoteNumberNormalized init (iNoteNumber - CIRCLE_SYNTH_NOTE_NUMBER_MIN) / giCircleSynth_NoteNumberRange
    iHeight init CIRCLE_SYNTH_HEIGHT_MIN + giCircleSynth_HeightRange * iNoteNumberNormalized
    iRadius init CIRCLE_SYNTH_RADIUS_MAX - giCircleSynth_RadiusRange * iNoteNumberNormalized
    log_i_debug("iNoteNumberNormalized = %f, iHeight = %f, iRadius = %f", iNoteNumberNormalized, iHeight, iRadius)

    iSpreadIncrement init iSecondsPerKPass * (CIRCLE_SYNTH_SPREAD_SPEED_MIN + iVelocity *
        giCircleSynth_SpreadSpeedRange)
    iSpreadAttenuationDecrement = iSpreadIncrement / (CIRCLE_SYNTH_SPREAD_MAX / 2)
    kSpread init 1 - iSpreadIncrement
    kSpreadAttenuation init 1 + iSpreadAttenuationDecrement
    kIsFullSpread init false
    if (kIsFullSpread == false) then
        kSpread += iSpreadIncrement
        kSpreadAttenuation -= iSpreadAttenuationDecrement
        if (kSpreadAttenuation < 0) then
            kSpreadAttenuation = 0
            kSpread = CIRCLE_SYNTH_SPREAD_MAX
            kIsFullSpread = true
        endif
        kLowPassCutoff = iLowPassCutoffBase + kSpread * iLowPassCutoffBaseOver360
    endif
    // log_k_debug("%d: kSpread = %f", kPass, kSpread)    

    kAmp = 0.1 * iVelocity * adsr_linsegr:k(1, 0, 1, 1)
    aOut = vco2(kAmp, iCps, 10, 0.5, 0, 0.5) // Square wave. NB: 0.5 fattens it up compared to default of 1.
    aOut = moogladder(aOut, kLowPassCutoff, 0)

    kPosition[] fillarray 0, 0, 0
    kSourceDistance = AF_3D_Audio_SourceDistance(kPosition)
    kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, k(giCircleSynth_DistanceMin),
        k(giCircleSynth_DistanceMax))
    aOutDistanced = aOut * kDistanceAttenuation
    aOut = aOut * (kDistanceAttenuation + kDistanceAttenuation) * kSpreadAttenuation
    AF_3D_Audio_ChannelGains(kPosition, kSpread)

    #if IS_PLAYBACK
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + gkAmbisonicChannelGains[0] * aOutDistanced
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + gkAmbisonicChannelGains[1] * aOutDistanced
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + gkAmbisonicChannelGains[2] * aOutDistanced
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + gkAmbisonicChannelGains[3] * aOutDistanced
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aOut
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aOut
    #else
        outch(
            1, gkAmbisonicChannelGains[0] * aOutDistanced,
            2, gkAmbisonicChannelGains[1] * aOutDistanced,
            3, gkAmbisonicChannelGains[2] * aOutDistanced,
            4, gkAmbisonicChannelGains[3] * aOutDistanced,
            5, aOut)
    #endif
    
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
giCircleSynth_NoteIndex[] init ORC_INSTANCE_COUNT

#endif // #ifndef CircleSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr CircleSynth_Json
        SJsonFile = sprintf("%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, ",\"heightMin\":%d", CIRCLE_SYNTH_HEIGHT_MIN)
        fprints(SJsonFile, ",\"heightMax\":%d", CIRCLE_SYNTH_HEIGHT_MAX)
        fprints(SJsonFile, ",\"radiusMin\":%d", CIRCLE_SYNTH_RADIUS_MAX)
        fprints(SJsonFile, ",\"radiusMax\":%d", CIRCLE_SYNTH_RADIUS_MAX)
        fprints(SJsonFile, ",\"spreadMax\":%d", CIRCLE_SYNTH_SPREAD_MAX)
        fprints(SJsonFile, ",\"spreadSpeedMin\":%d", CIRCLE_SYNTH_SPREAD_SPEED_MIN)
        fprints(SJsonFile, ",\"spreadSpeedMax\":%d", CIRCLE_SYNTH_SPREAD_SPEED_MAX)
        fprints(SJsonFile, ",\"noteNumberMin\":%d", CIRCLE_SYNTH_NOTE_NUMBER_MIN)
        fprints(SJsonFile, ",\"noteNumberMax\":%d", CIRCLE_SYNTH_NOTE_NUMBER_MAX)
        fprints(SJsonFile, ",\"soundDistanceMin\":%d", giCircleSynth_DistanceMin)
        fprints(SJsonFile, ",\"soundDistanceMax\":%d", giCircleSynth_DistanceMax)
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

        iInstrumentNumber = p1 + 0.0001
        SOnEvent = sprintf("i %.4f 0 -1 %d %d %d", iInstrumentNumber, EVENT_NOTE_GENERATED, iNoteNumber, iVelocity)
        scoreline_i(SOnEvent)

        kReleased = release()
        if (kReleased == true) then
            SOffEvent = sprintfk("i -%.4f 0 1", iInstrumentNumber)
            scoreline(SOffEvent, 1)
        endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (giCircleSynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"CircleSynth_Json\" 0 0")
            endif
            giCircleSynth_NoteIndex[ORC_INSTANCE_INDEX] = giCircleSynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("%s.%d.json", INSTRUMENT_PLUGIN_UUID, giCircleSynth_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f,\"note\":%.3f,\"velocity\":%.3f},", times(), iNoteNumber, iVelocity)
            if (kReleased == true) then
                fprintks(SJsonFile, "\"noteOff\":{\"time\":%.3f}}", times:k())
            endif
        ${CSOUND_ENDIF}

        if (kReleased == true) then
            turnoff
        endif
    elseif (iEventType == EVENT_NOTE_GENERATED) then
        iNoteNumber = p5
        iVelocity = p6

        #if IS_PLAYBACK
            aDummy subinstr giCircleSynthNoteInstrumentNumber,
                iNoteNumber,
                iVelocity,
                ORC_INSTANCE_INDEX,
                INSTRUMENT_TRACK_INDEX
        #else
            a1, a2, a3, a4, aOut subinstr giCircleSynthNoteInstrumentNumber,
                iNoteNumber,
                iVelocity,
                ORC_INSTANCE_INDEX,
                INSTRUMENT_TRACK_INDEX

            outch(1, a1, 2, a2, 3, a3, 4, a4, 5, aOut, 6, aOut)

            if (gkReloaded == true) then
                log_k_trace("Turning off instrument %.04f due to reload.", p1)
                turnoff
            endif
        #endif
    endif
endin:
endin

//----------------------------------------------------------------------------------------------------------------------
