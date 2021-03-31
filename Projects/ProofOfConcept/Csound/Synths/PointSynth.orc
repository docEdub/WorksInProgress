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

    iEventType = p4
    if (iEventType == EVENT_CC) then
        aUnused subinstr giPointSynthCcEventInstrumentNumber, p5, p6, ORC_INSTANCE_INDEX
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        iNoteNumber = p5
        iVelocity = p6
        iFadeInTime = 0.02
        iFadeOutTime = 0.1
        iTotalTime = iFadeInTime + iFadeOutTime
        if (iNoteNumber < 128) then
            kI init 1
            kJ init 0
            kCountdown init 0.05
            kCountdown -= 1 / kr
            if (kCountdown <= 0) then

                // Generate new note.
                kJ += 1
                if (kJ == 1000) then
                    kJ = 1
                endif
                kInstrumentNumber = p1 + kJ / 1000000
                kNoteNumberOffsetDivisor = 2 + abs(rand:k(12, iNoteNumber / 128))
                log_k_debug("kNoteNumberOffsetDivisor = %f, kI = %d, kJ = %d", kNoteNumberOffsetDivisor, kI, kJ)
                SEvent = sprintfk("i %.6f 0 %.2f %d %.3f %.3f", kInstrumentNumber, iTotalTime, p4,
                    iNoteNumber + 1000 + kI / kNoteNumberOffsetDivisor,
                    iVelocity - kI)
                log_k_debug("SEvent = %s", SEvent)
                scoreline(SEvent, 1)
                kCountdown = rand(0.2, iNoteNumber / 128) + 0.2
                kI += 1
                if (kI > 64) then
                    kI = 1
                endif
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
            iCPS = cpsmidinn(p5 - 1000)
            aOut = pluck(0.005 * (iVelocity / 127), k(iCPS), iCPS, 0, 1)

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
                kFadeTimeLeft init 0.1
                if (gkReloaded == true) then
                    log_k_debug("Turning off instrument %.04f due to reload.", p1)
                    aEnvelope = linseg(1, 0.1, 0)
                    kReloaded = gkReloaded
                endif

                ; outc(aOut, aOut, aOut, aOut, aOut, aOut)
                a0 init 0
                outc(a0, a0, a0, aOut, aOut, aOut)

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
