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
${CSOUND_INCLUDE} "json_opcodes.orc"

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

instr PowerLineSynth_NoteOn
    iNoteNumber = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7

    log_i_info("PowerLineSynth_NoteOn ...")

    iSecondsPerKPass = 1 / kr

    // Max amount of seconds to keep rising. The riser table is exponentional. It rises slower and slower as time
    // passes, and eventually maxes out at 1. When the max rise time is exceeded, the riser value stays at 1.
    iMaxRiseTime = 10

    // While the note is held it takes iMaxRiseTime seconds for the position to move from iNoteOnStart to iNoteOnEnd.
    // When the note is released, the position's Z coordinate moves from it's current location to iNoteOffEndZ at a
    // speed determined by how long the note was held. The longer the note is held, the faster it moves to iNoteOffEndZ
    // when the note is released.
    iNoteOnStartPosition[] = fillarray(10, 0, 20)
    iNoteOnEndPosition[] = fillarray(15, 10, 25)
    iNoteOffEndZ = -1000

    iNoteOnDelta[] fillarray \
        iNoteOnEndPosition[$X] - iNoteOnStartPosition[$X], \
        iNoteOnEndPosition[$Y] - iNoteOnStartPosition[$Y], \
        iNoteOnEndPosition[$Z] - iNoteOnStartPosition[$Z]
    iNoteOnIncrementX = iSecondsPerKPass * (iNoteOnDelta[$X] / iMaxRiseTime)
    iNoteOnIncrementZ = iSecondsPerKPass * (iNoteOnDelta[$Z] / iMaxRiseTime)

    kPosition[] fillarray iNoteOnStartPosition[$X], iNoteOnStartPosition[$Y], iNoteOnStartPosition[$Z]
    if (kPosition[$Z] < iNoteOffEndZ) then
        kgoto endin
    endif

    // Rise from C2 (note #36) to the given note number.
    iMaxRiseAmount = iNoteNumber - 36
    iNoteNumber = 36

    // The amount of "wobble" the pitch will have when it starts rising. The wobble will decrease from 1 to 0 inversely
    // proportionate to the rise amount until there is zero wobble when the rise amount reaches 1.
    iNoteNumberWobbleStartAmp = 1.5

    // The speed of the pitch "wobble" LFO in hertz.
    iNoteNumberWobbleSpeed = 5

    iRiserTableSize = 1024
    iWobbleTableSize = 1024

    kReleased = release()
    
    // Exponential curve from 0 to 1, slowing when approaching 1.
    iRiserTableId = ftgenonce(0, 0, iRiserTableSize + GUARD_POINT_SIZE, 16, 0, iRiserTableSize, -10, 1)
    iRiserTableIncrementI = iSecondsPerKPass * (iRiserTableSize / iMaxRiseTime)
    kRiserTableI init 0
    if (kRiserTableI < iRiserTableSize && kReleased == false) then
        kRiserTableI += iRiserTableIncrementI
    endif
    kRiserTableValue = tablei(kRiserTableI, iRiserTableId)

    if (kReleased == false) then
        // kRiserTableI is less than iRiserTableSize for the entire duration of iMaxRiseTime.
        if (kRiserTableI < iRiserTableSize) then
            kPosition[$X] = kPosition[$X] + iNoteOnIncrementX
            kPosition[$Y] = iNoteOnStartPosition[$Y] + iNoteOnDelta[$Y] * kRiserTableValue
            kPosition[$Z] = kPosition[$Z] + iNoteOnIncrementZ
        endif
    else
        iMinNoteOffSpeed = 50 // per second
        iMaxNoteOffSpeed = 100 // per second

        // This is the longest the note off duration can be. If the entire duration is not needed, skip to endin until
        // the instrument times out since a subinstrument can't use the turnoff opcode.
        iExtraTime = abs(iNoteOffEndZ - iNoteOnStartPosition[$Z]) / iMinNoteOffSpeed
        xtratim(iExtraTime)
 
        kNoteOffSpeed init iMinNoteOffSpeed
        kNoteOffIncrementZ init iSecondsPerKPass * iMinNoteOffSpeed
        kNoteOffSpeedCalculated init false

        if (kNoteOffSpeedCalculated == false) then
            kNoteOffSpeed = iMinNoteOffSpeed +
                ((iMaxNoteOffSpeed - iMinNoteOffSpeed) * (kRiserTableI / iRiserTableSize))
            kNoteOffSpeed = min(kNoteOffSpeed, iMaxNoteOffSpeed)
            kNoteOffIncrementZ = iSecondsPerKPass * kNoteOffSpeed
            kNoteOffSpeedCalculated = true
        else
            kPosition[$Z] = kPosition[$Z] - kNoteOffIncrementZ
        endif
    endif

    // 1 cycle of a sine wave.
    iWobbleTableId = ftgenonce(0, 0, 1024, 10, 1)
    iWobbleTableIncrementI = iNoteNumberWobbleSpeed * (iSecondsPerKPass * iWobbleTableSize)
    kWobbleTableI init 0
    kWobbleTableI += iWobbleTableIncrementI
    kWobbleTableI = kWobbleTableI % iWobbleTableSize
    kNoteNumberWobbleAmp = iNoteNumberWobbleStartAmp * (1 - kRiserTableValue)

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
        kAmp *= (iNoteOffEndZ - kPosition[$Z]) / iNoteOffEndZ
    endif
    kCps = cpsmidinn(kNoteNumber)
    aOut = vco2(kAmp, kCps, 10, 0.5, 0, 0.5) // Square wave. NB: 0.5 fattens it up compared to default of 1.
    aOut = tone(aOut, 5000)

    kSourceDistance = AF_3D_Audio_SourceDistance(kPosition)
    kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kSourceDistance, k(giMinDistance), k(giMaxDistance))
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

#endif // #ifndef PowerLineSynth_orc__include_guard

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
