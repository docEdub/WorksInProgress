#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: PowerLineSynth.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef PowerLineSynth_orc__include_guard
#define PowerLineSynth_orc__include_guard

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

// Max amount of seconds to keep rising. The riser table is exponentional. It rises slower and slower as time
// passes, and eventually maxes out at 1. When the max rise time is exceeded, the riser value stays at 1.
giMaxRiseTime = 10

// While the note is held it takes giMaxRiseTime seconds for the position to move from iNoteOnStart to iNoteOnEnd.
// When the note is released, the position's Z coordinate moves from it's current location to giNoteOffEndZ at a
// speed determined by how long the note was held. The longer the note is held, the faster it moves to giNoteOffEndZ
// when the note is released.
giNoteOnStartPosition[] = fillarray(10, 0, 20)
giNoteOnEndPosition[] = fillarray(15, 10, 25)
giNoteOffEndZ = -1000

// The amount of "wobble" the pitch will have when it starts rising. The wobble will decrease from 1 to 0 inversely
// proportionate to the rise amount until there is zero wobble when the rise amount reaches 1.
giNoteNumberWobbleStartAmp = 1.5

// The speed of the pitch "wobble" LFO in hertz.
giNoteNumberWobbleSpeed = 5

giRiserTableSize = 1024
giWobbleTableSize = 1024

giMinNoteOffSpeed = 50 // per second
giMaxNoteOffSpeed = 100 // per second

giPowerLineSynth_DistanceMin = 5
giPowerLineSynth_DistanceMax = 100

instr PowerLineSynth_NoteOn
    iNoteNumber = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7

    log_i_info("PowerLineSynth_NoteOn ...")

    iSecondsPerKPass = 1 / kr

    iNoteOnDelta[] fillarray \
        giNoteOnEndPosition[$X] - giNoteOnStartPosition[$X], \
        giNoteOnEndPosition[$Y] - giNoteOnStartPosition[$Y], \
        giNoteOnEndPosition[$Z] - giNoteOnStartPosition[$Z]
    iNoteOnIncrementX = iSecondsPerKPass * (iNoteOnDelta[$X] / giMaxRiseTime)
    iNoteOnIncrementZ = iSecondsPerKPass * (iNoteOnDelta[$Z] / giMaxRiseTime)

    kPosition[] fillarray giNoteOnStartPosition[$X], giNoteOnStartPosition[$Y], giNoteOnStartPosition[$Z]
    if (kPosition[$Z] < giNoteOffEndZ) then
        kgoto endin
    endif

    // Rise from C2 (note #36) to the given note number.
    iMaxRiseAmount = iNoteNumber - 36
    iNoteNumber = 36

    kReleased = release()
    
    // Exponential curve from 0 to 1, slowing when approaching 1.
    iRiserTableId = ftgenonce(0, 0, giRiserTableSize + GUARD_POINT_SIZE, 16, 0, giRiserTableSize, -10, 1)
    iRiserTableIncrementI = iSecondsPerKPass * (giRiserTableSize / giMaxRiseTime)
    kRiserTableI init 0
    if (kRiserTableI < giRiserTableSize && kReleased == false) then
        kRiserTableI += iRiserTableIncrementI
    endif
    kRiserTableValue = tablei(kRiserTableI, iRiserTableId)

    if (kReleased == false) then
        // kRiserTableI is less than giRiserTableSize for the entire duration of giMaxRiseTime.
        if (kRiserTableI < giRiserTableSize) then
            kPosition[$X] = kPosition[$X] + iNoteOnIncrementX
            kPosition[$Y] = giNoteOnStartPosition[$Y] + iNoteOnDelta[$Y] * kRiserTableValue
            kPosition[$Z] = kPosition[$Z] + iNoteOnIncrementZ
        endif
    else
        // This is the longest the note off duration can be. If the entire duration is not needed, skip to endin until
        // the instrument times out since a subinstrument can't use the turnoff opcode.
        iExtraTime = abs(giNoteOffEndZ - giNoteOnStartPosition[$Z]) / giMinNoteOffSpeed
        xtratim(iExtraTime)
 
        kNoteOffSpeed init giMinNoteOffSpeed
        kNoteOffIncrementZ init iSecondsPerKPass * giMinNoteOffSpeed
        kNoteOffSpeedCalculated init false

        if (kNoteOffSpeedCalculated == false) then
            kNoteOffSpeed = giMinNoteOffSpeed +
                ((giMaxNoteOffSpeed - giMinNoteOffSpeed) * (kRiserTableI / giRiserTableSize))
            kNoteOffSpeed = min(kNoteOffSpeed, giMaxNoteOffSpeed)
            kNoteOffIncrementZ = iSecondsPerKPass * kNoteOffSpeed
            kNoteOffSpeedCalculated = true
        else
            kPosition[$Z] = kPosition[$Z] - kNoteOffIncrementZ
        endif
    endif

    // 1 cycle of a sine wave.
    iWobbleTableId = ftgenonce(0, 0, 1024, 10, 1)
    iWobbleTableIncrementI = giNoteNumberWobbleSpeed * (iSecondsPerKPass * giWobbleTableSize)
    kWobbleTableI init 0
    kWobbleTableI += iWobbleTableIncrementI
    kWobbleTableI = kWobbleTableI % giWobbleTableSize
    kNoteNumberWobbleAmp = giNoteNumberWobbleStartAmp * (1 - kRiserTableValue)

    kNoteNumber = iNoteNumber
    kNoteNumber += kRiserTableValue * iMaxRiseAmount
    kNoteNumber += tablei(kWobbleTableI, iWobbleTableId) * kNoteNumberWobbleAmp
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

    kAmp = 0.1 * iVelocity * kRiserTableValue
    if (kReleased == true) then
        kAmp *= (giNoteOffEndZ - kPosition[$Z]) / giNoteOffEndZ
    endif
    kCps = cpsmidinn(kNoteNumber)
    aOut = vco2(kAmp, kCps, 10, 0.5, 0, 0.5) // Square wave. NB: 0.5 fattens it up compared to default of 1.
    aOut = tone(aOut, 5000)

    kSourceDistance = AF_3D_Audio_SourceDistance(kPosition)
    kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, k(giPowerLineSynth_DistanceMin), k(giPowerLineSynth_DistanceMax))
    aOutDistanced = aOut * kDistanceAttenuation
    aOut = aOut * (2 * kDistanceAttenuation)
    kAmbisonicChannelGains[] = AF_3D_Audio_ChannelGains(kPosition, 1)
    a1 = kAmbisonicChannelGains[0] * aOutDistanced
    a2 = kAmbisonicChannelGains[1] * aOutDistanced
    a3 = kAmbisonicChannelGains[2] * aOutDistanced
    a4 = kAmbisonicChannelGains[3] * aOutDistanced
    outch(1, a1, 2, a2, 3, a3, 4, a4, 5, aOut)

    log_i_trace("PowerLineSynth_NoteOn - done")
endin:
endin

instr PowerLineSynth_NoteOff
    iNoteNumber = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7
endin

giPowerLineSynthNoteInstrumentNumber = nstrnum("PowerLineSynth_NoteOn")
giPowerLineSynth_NoteIndex[] init ORC_INSTANCE_COUNT

#endif // #ifndef PowerLineSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr PowerLineSynth_Json
        SJsonFile = sprintf("%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, ",\"maxRiseTime\":%d", giMaxRiseTime)
        fprints(SJsonFile, ",\"noteOnStartPosition\":[%d,%d,%d]", giNoteOnStartPosition[$X], giNoteOnStartPosition[$Y], giNoteOnStartPosition[$Z])
        fprints(SJsonFile, ",\"noteOnEndPosition\":[%d,%d,%d]", giNoteOnEndPosition[$X], giNoteOnEndPosition[$Y],  giNoteOnEndPosition[$Z])
        fprints(SJsonFile, ",\"noteOffEndZ\":%d", giNoteOffEndZ)
        fprints(SJsonFile, ",\"noteNumberWobbleStartAmp\":%.3f", giNoteNumberWobbleStartAmp)
        fprints(SJsonFile, ",\"noteNumberWobbleSpeed\":%.3f", giNoteNumberWobbleSpeed)
        fprints(SJsonFile, ",\"minNoteOffSpeed\":%d", giMinNoteOffSpeed)
        fprints(SJsonFile, ",\"maxNoteOffSpeed\":%d", giMaxNoteOffSpeed)
        fprints(SJsonFile, ",\"soundDistanceMin\":%d", giPowerLineSynth_DistanceMin)
        fprints(SJsonFile, ",\"soundDistanceMax\":%d", giPowerLineSynth_DistanceMax)
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
            turnoff
        endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (giPowerLineSynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"PowerLineSynth_Json\" 0 0")
            endif
            giPowerLineSynth_NoteIndex[ORC_INSTANCE_INDEX] = giPowerLineSynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("%s.%d.json", INSTRUMENT_PLUGIN_UUID, giPowerLineSynth_NoteIndex[ORC_INSTANCE_INDEX])
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

        a1, a2, a3, a4, aOut subinstr giPowerLineSynthNoteInstrumentNumber,
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
