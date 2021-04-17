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

giMaxDistance = 100
giMinDistance = 5
giMinDistanceAttenuation = AF_3D_Audio_DistanceAttenuation_i(0, giMinDistance, giMaxDistance)

${CSOUND_DEFINE} POINT_SYNTH_NEXT_RTZ_COUNT #16384#
giPointSynthNextRT[][][] init ORC_INSTANCE_COUNT, $POINT_SYNTH_NEXT_RTZ_COUNT, 2
giPointSynthNextRTZ_i init 0

iI = 0
while (iI < ORC_INSTANCE_COUNT) do
    seed(1 + iI * 1000)
    iJ = 0
    while (iJ < $POINT_SYNTH_NEXT_RTZ_COUNT) do
        giPointSynthNextRT[iI][iJ][$R] = giMinDistance + rnd(giMaxDistance - giMinDistance)
        giPointSynthNextRT[iI][iJ][$T] = rnd(359.999)
        iJ += 1
    od
    iI += 1
od

#endif // #ifndef PointSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

instr INSTRUMENT_ID

    iEventType = p4
    if (iEventType == EVENT_CC) then
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        iNoteNumber = p5
        iVelocity = p6
        iFadeInTime = 0.01
        iFadeOutTime = 0.01
        iTotalTime = iFadeInTime + iFadeOutTime
        iSeed = iNoteNumber / 128
        if (iNoteNumber < 128) then
            kI init 0
            kCountdownNeedsInit init true
            if (kCountdownNeedsInit == true) then
                kJ = 0
                while (kJ < iNoteNumber) do
                    kCountdown = 0.5 + abs(rand(0.5, iSeed))
                    kJ += 1
                od
                kCountdownNeedsInit = false
            endif
            kCountdown -= 1 / kr
            if (kCountdown <= 0) then
                // Generate new note.
                kI += 1
                if (kI == 1000) then
                    kI = 1
                endif
                kInstrumentNumber = p1 + kI / 1000000
                kNoteNumber = 1000 + iNoteNumber + abs(rand(12, iSeed))
                kVelocity = min(iVelocity + rand:k(16, iSeed), 127)
                SEvent = sprintfk("i %.6f 0 %.2f %d %.3f %.3f", kInstrumentNumber, iTotalTime, p4,
                    kNoteNumber,
                    kVelocity)
                log_k_debug("SEvent = %s", SEvent)
                scoreline(SEvent, 1)
                kCountdownNeedsInit = true
            endif
            
            #if !IS_PLAYBACK
                if (gkReloaded == true) then
                    turnoff
                endif
            #endif
        else ; iNoteNumber > 127 : Instance was generated recursively.
            iNoteNumber -= 1000
            if (iNoteNumber > 127) then
                log_k_error("Note number is greater than 127 (iNoteNumber = %f.", iNoteNumber)
                igoto endin
                turnoff
            endif
            iCps = cpsmidinn(p5 - 1000)
            iAmp = 0.05

            kCps = linseg(iCps, iTotalTime, iCps + 100)

            aOut = oscil(iAmp, kCps)
            aEnvelope = adsr_linsegr(iFadeInTime, 0, 1, iFadeOutTime)
            aOut *= aEnvelope

            kR init giPointSynthNextRT[ORC_INSTANCE_INDEX][giPointSynthNextRTZ_i][$R]
            kT init giPointSynthNextRT[ORC_INSTANCE_INDEX][giPointSynthNextRTZ_i][$T]
            kZ init 10 + 10 * (iNoteNumber / 127)
            log_i_debug("rtz = (%f, %f, %f)", i(kR), i(kT), i(kZ))
            kDistanceAmp = AF_3D_Audio_DistanceAttenuation(sqrt(kR * kR + kZ * kZ), giMinDistance, giMaxDistance)
            aOutDistanced = aOut * kDistanceAmp

            giPointSynthNextRTZ_i += 1
            if (giPointSynthNextRTZ_i == $POINT_SYNTH_NEXT_RTZ_COUNT) then
                giPointSynthNextRTZ_i = 0
            endif
            kAmbisonicChannelGains[] = AF_3D_Audio_ChannelGains_RTZ(kR, kT, kZ)
            a1 = kAmbisonicChannelGains[0] * aOutDistanced
            a2 = kAmbisonicChannelGains[1] * aOutDistanced
            a3 = kAmbisonicChannelGains[2] * aOutDistanced
            a4 = kAmbisonicChannelGains[3] * aOutDistanced

            #if IS_PLAYBACK
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + a1
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + a2
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + a3
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + a4
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aOut
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aOut
            #else
                kReloaded init false
                kFadeTimeLeft init 0.1
                if (gkReloaded == true) then
                    log_k_debug("Turning off instrument %.04f due to reload.", p1)
                    aEnvelope = linseg(1, 0.1, 0)
                    kReloaded = gkReloaded
                endif

                outc(a1, a2, a3, a4, aOut, aOut)

                if (kReloaded == true) then
                    kFadeTimeLeft -= 1 / kr
                    if (kFadeTimeLeft <= 0) then
                        turnoff
                    endif
                endif
            #endif            
        endif
    endif
endin:
endin

//----------------------------------------------------------------------------------------------------------------------
