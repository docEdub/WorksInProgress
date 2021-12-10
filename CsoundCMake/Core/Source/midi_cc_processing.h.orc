#include "definitions.h"

#if !defined(IS_EFFECT) && !defined(IS_SYNTH)
    #error Unknown plugin type
#endif

#if defined(IS_EFFECT) && defined(IS_SYNTH)
    #error Plugin can not be an effect and a synth
#endif

#ifdef IS_EFFECT
    #define MODE_4_INSTRUMENT sprintfk("%s_%d_%d", STRINGIZE($INSTRUMENT_NAME), gk_trackIndex, gk_pluginIndex)
#endif
#ifdef IS_SYNTH
    #define MODE_4_INSTRUMENT sprintfk("%s_%d", STRINGIZE($INSTRUMENT_NAME), gk_trackIndex)
#endif

//======================================================================================================================
// MIDI CC processing instrument. Always on.
//
// NB: The instrument number used here should be lower than the instrument number being used to process notes so Csound
// processes CC events before note events.
//
// NB: This instrument uses macros defined in the main instrument .orc file included above.
//======================================================================================================================

instr CSOUND_MIDI_CC_PROCESSING_INSTRUMENT_NUMBER
    iCcCount = giCcCount_$INSTRUMENT_NAME
    log_i_debug("instr %d, CC count = %d", p1, iCcCount)

    #ifdef IS_SYNTH
        if (gk_trackIndex == -1) then
            kgoto end
        endif
    #endif

    // In mode 4 playback, initialize CCs not set to default.
    // NB: The CCs are initialized at 0.01 seconds instead of 0 so they don't get overwritten by the instrument that
    // initializes the CC values at the start.
    if (gk_playing == true && gk_mode == 4 && (changed(gk_mode) == true || changed(gk_playing) == true)) then
        kI = 0
        while (kI < iCcCount) do
            SInstrument = MODE_4_INSTRUMENT
            if (strcmpk(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_TYPE], "string") == 0) then
                SValue = chngetks(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL])
                SScoreLine = sprintfk("i  %s    0.01 1 %s %d \\\"%s\\\"", SInstrument, "Cc", kI, SValue)
                sendScoreMessage_k(SScoreLine)
            else
                kValue = round(100 * chnget:k(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL])) / 100
                if (gkCcSyncTypes_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] == $CC_SYNC_TO_CHANNEL &&
                        kValue != giCcValueDefaults_$INSTRUMENT_NAME[kI]) then
                    SScoreLine = sprintfk("i  %s    0.01 1 %s %d %.02f", SInstrument, "Cc", kI, kValue)
                    sendScoreMessage_k(SScoreLine)
                endif
            endif
            kI += 1
        od
    endif

    // Update CCs.
    kI = 0
    while (kI < iCcCount) do
        if (gkCcSyncTypes_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] == $CC_SYNC_TO_CHANNEL) then
            if (strcmpk(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_TYPE], "string") == 0) then
                SPreviousValue = sprintfk("%s", gSCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI])
                SValue = chngetks(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL])
                if (strcmpk(SPreviousValue, SValue) != 0) then
                    log_k_debug("String channel '%s' changed from '%s' to '%s'", gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL], SPreviousValue, SValue)
                    gSCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] = sprintfk("%s", SValue)
                    if (gk_mode == 4) then
                        SInstrument = MODE_4_INSTRUMENT
                        SScoreLine = sprintfk("i  %s    %.03f 1 %s %d \\\"%s\\\"", SInstrument, elapsedTime_k(), "Cc", kI, SValue)
                        sendScoreMessage_k(SScoreLine)
                    endif
                    // Send CC message to .orc in all modes to prevent infinite loop caused by SPreviousValue not
                    // getting updated.
                    SInstrument = sprintfk("%s", "\"$INSTRUMENT_NAME\"")
                    SScoreLine = sprintfk("i  %s    0 1 %d %d \"%s\"", SInstrument, EVENT_CC, kI, SValue)
                    scoreline(SScoreLine, 1)
                endif
            else
                kPreviousValue = gkCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI]
                kValue = round(100 * chnget:k(gSCcInfo_$INSTRUMENT_NAME[kI][0])) / 100
                if (kValue != kPreviousValue) then
                    ; log_k_debug("CC %s = %f", gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL], kValue)
                    gkCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] = kValue

                    if (gk_mode == 4) then
                        SInstrument = MODE_4_INSTRUMENT
                        SScoreLine = sprintfk("i  %s    %.03f 1 %s %d %.02f", SInstrument, elapsedTime_k(), "Cc", kI, kValue)
                        sendScoreMessage_k(SScoreLine)
                    else
                        SInstrument = "\"$INSTRUMENT_NAME\""
                        SScoreLine = sprintfk("i  %s    0 1 %d %d %.02f", SInstrument, EVENT_CC, kI, kValue)
                        scoreline(SScoreLine, 1)
                    endif
                endif
            endif
        endif
        kI += 1
    od
end:
endin

alwayson(CSOUND_MIDI_CC_PROCESSING_INSTRUMENT_NUMBER)
