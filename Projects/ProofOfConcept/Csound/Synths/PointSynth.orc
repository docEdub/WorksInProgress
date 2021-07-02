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
${CSOUND_INCLUDE} "math.orc"

giPointSynth_DistanceMin = 5
giPointSynth_DistanceMax = 100
giPointSynth_DistanceMinAttenuation = AF_3D_Audio_DistanceAttenuation_i(0, giPointSynth_DistanceMin, giPointSynth_DistanceMax)

${CSOUND_DEFINE} POINT_SYNTH_NEXT_XYZ_COUNT #16384#
giPointSynthNextXYZ[][][] init ORC_INSTANCE_COUNT, $POINT_SYNTH_NEXT_XYZ_COUNT, 3
giPointSynthNextXYZ_i init 0

iI = 0
while (iI < ORC_INSTANCE_COUNT) do
    seed(1 + iI * 1000)
    iJ = 0
    while (iJ < $POINT_SYNTH_NEXT_XYZ_COUNT) do
        iR = giPointSynth_DistanceMin + rnd(giPointSynth_DistanceMax - giPointSynth_DistanceMin)
        iT = rnd(359.999)
        iXYZ[] = math_rytToXyz(iR, 0, iT)
        giPointSynthNextXYZ[iI][iJ][$X] = 0 // iXYZ[$X]
        giPointSynthNextXYZ[iI][iJ][$Y] = 2 // iXYZ[$Y]
        giPointSynthNextXYZ[iI][iJ][$Z] = 50 // iXYZ[$Z]
        iJ += 1
    od
    iI += 1
od

giPointSynth_NoteIndex[] init ORC_INSTANCE_COUNT
gkPointSynth_InstrumentNumberFraction[] init ORC_INSTANCE_COUNT
gkPointSynth_LastNoteOnTime[] init ORC_INSTANCE_COUNT

#endif // #ifndef PointSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr PointSynth_Json
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, ",\"soundDistanceMin\":%d", giPointSynth_DistanceMin)
        fprints(SJsonFile, ",\"soundDistanceMax\":%d", giPointSynth_DistanceMax)
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
        iFadeInTime = 0.01
        iFadeOutTime = 0.01
        iTotalTime = iFadeInTime + iFadeOutTime

#if !IS_PLAYBACK
        if (iNoteNumber < 128) then
            iSeed = iNoteNumber / 128

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
                kCountdownNeedsInit = true

                // Generate new note.
                gkPointSynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = gkPointSynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] + 1
                if (gkPointSynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] == 1000) then
                    gkPointSynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] = 1
                endif
                kNoteNumber = 1000 + iNoteNumber + abs(rand(12, iSeed))
                kVelocity = min(iVelocity + rand:k(16, iSeed), 127)
                if (i(gk_mode) == 4) then
                    kInstrumentNumberFraction = gkPointSynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX]
                    // Skip to end if track index is -1 due to mode switch lag.
                    if (gk_trackIndex == -1) kgoto end

                    // The Oculus Quest 2 can't handle 2 note on events at the same time, even if this instrument is
                    // preallocated with the prealloc opcode. This spaces them out so there's never 2 instances playitng
                    // at the same time.
                    // TODO: Undo this. The Quest 2 can handle 2 notes just fine if the instrument is preallocated using
                    // a score event instead of relying on the prealloc opcode.
                    kNoteOnTime = elapsedTime_k()
                    if (kNoteOnTime - gkPointSynth_LastNoteOnTime[ORC_INSTANCE_INDEX] < (iTotalTime + iTotalTime)) then
                        kNoteOnTime = gkPointSynth_LastNoteOnTime[ORC_INSTANCE_INDEX] + iTotalTime + iTotalTime
                    endif
                    gkPointSynth_LastNoteOnTime[ORC_INSTANCE_INDEX] = kNoteOnTime

                    sendScoreMessage_k(sprintfk("i  CONCAT(%s_%d, .%03d) %.03f %.03f EVENT_NOTE_ON Note(%d) Velocity(%d)",
                        STRINGIZE(${InstrumentName}), gk_trackIndex, kInstrumentNumberFraction, kNoteOnTime, iTotalTime, kNoteNumber, kVelocity))
                    goto end
                endif
                kInstrumentNumberFraction = gkPointSynth_InstrumentNumberFraction[ORC_INSTANCE_INDEX] / 1000000
                SEvent = sprintfk("i %.6f 0 %.2f %d %.3f %.3f", p1 + kInstrumentNumberFraction, iTotalTime, p4,
                    kNoteNumber,
                    kVelocity)
                scoreline(SEvent, 1)
            endif
            
            if (gkReloaded == true) then
                turnoff
            endif
        else ; iNoteNumber > 127 : Instance was generated recursively.
#endif // #if !IS_PLAYBACK
            iNoteNumber -= 1000
            if (iNoteNumber > 127) then
                log_k_error("Note number is greater than 127 (iNoteNumber = %f.", iNoteNumber)
                igoto end
                turnoff
            endif
            iCps = cpsmidinn(p5 - 1000)
            iAmp = 0.05

            kCps = linseg(iCps, iTotalTime, iCps + 100)

            aOut = oscil(iAmp, kCps)
            aEnvelope = adsr_linsegr(iFadeInTime, 0, 1, iFadeOutTime)
            aOut *= aEnvelope

            iX init giPointSynthNextXYZ[ORC_INSTANCE_INDEX][giPointSynthNextXYZ_i][$X]
            iZ init giPointSynthNextXYZ[ORC_INSTANCE_INDEX][giPointSynthNextXYZ_i][$Z]
            iY init 10 + 10 * (iNoteNumber / 127)
            kDistance = AF_3D_Audio_SourceDistance(iX, iY, iZ)
            ; printsk("kDistance = %.3f\n", kDistance)
            kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, giPointSynth_DistanceMax) * 16
            aOutDistanced = aOut * kDistanceAmp

            giPointSynthNextXYZ_i += 1
            if (giPointSynthNextXYZ_i == $POINT_SYNTH_NEXT_XYZ_COUNT) then
                giPointSynthNextXYZ_i = 0
            endif
            AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
            a1 = gkAmbisonicChannelGains[0] * aOutDistanced
            a2 = gkAmbisonicChannelGains[1] * aOutDistanced
            a3 = gkAmbisonicChannelGains[2] * aOutDistanced
            a4 = gkAmbisonicChannelGains[3] * aOutDistanced

            #if IS_PLAYBACK
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + a1
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + a2
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + a3
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + a4
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + aOut * 0.033
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + aOut * 0.033
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

            ${CSOUND_IFDEF} IS_GENERATING_JSON
                if (giPointSynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                    scoreline_i("i \"PointSynth_Json\" 0 0")
                endif
                giPointSynth_NoteIndex[ORC_INSTANCE_INDEX] = giPointSynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
                SJsonFile = sprintf("json/%s.%d.json", INSTRUMENT_PLUGIN_UUID, giPointSynth_NoteIndex[ORC_INSTANCE_INDEX])
                fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f,\"note\":%.3f,\"xyz\":[%.3f,%.3f,%.3f]}}", times(),
                    iNoteNumber, iX, iY, iZ)
            ${CSOUND_ENDIF}
#if !IS_PLAYBACK
        endif
#endif
    endif
end:
endin


#if IS_PLAYBACK
    instr CONCAT(Preallocate_, INSTRUMENT_ID)
        ii = 0
        while (ii < giPresetUuidPreallocationCount[INSTRUMENT_TRACK_INDEX]) do
            scoreline_i(sprintf("i %d.%.3d 0 .1 %d 1063 63", INSTRUMENT_ID, ii, EVENT_NOTE_ON))
            ii += 1
        od
        turnoff
    endin
    scoreline_i(sprintf("i \"Preallocate_%d\" 0 -1", INSTRUMENT_ID))
#endif

//----------------------------------------------------------------------------------------------------------------------
