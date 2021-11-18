#include <definitions.h>

<CsoundSynthesizer>
<CsOptions>

#include "csd_options.h"

</CsOptions>
<CsInstruments>

#define IN_CHANNEL_COUNT 6
#define OUT_CHANNEL_COUNT 6

#include "cabbage_effect_global.h"

#define ORC_INSTANCE_INDEX 0 // When a .csd wraps an .orc there's only one orc instance in use at index 0.
${CSOUND_DEFINE} INSTRUMENT_NAME #${InstrumentName}#
${CSOUND_DEFINE} ORC_FILENAME #"${InstrumentName}.orc"#
${CSOUND_DEFINE} CSD_FILE_PATH #__FILE__#
${CSOUND_INCLUDE} "cabbage_effect_global.orc"
${CSOUND_INCLUDE} "TrackInfo_global.orc"
${CSOUND_INCLUDE} "PositionOpcode_global.orc"
${CSOUND_INCLUDE} "watchOrcFile.orc"


//======================================================================================================================
// Main processing instrument. Always on.
//======================================================================================================================

instr 1
    ${CSOUND_INCLUDE} "cabbage_core_instr_1_head.orc"
    log_i_info("instr %d ...", p1)
    ${CSOUND_INCLUDE} "TrackInfo_instr_1_head.orc"
    ${CSOUND_INCLUDE} "PositionOpcode_instr_1_head.orc"

    if (gk_mode == 1) then
        kgoto end
    else
        kMaxChannel = 6
    endif

    // Create an array of signals. 1 for each of the first 4 output channels. Reverb.orc will output channels 5 and
    // 6 in mode 1.
    a_signal[] init nchnls

    // For each output channel that has a matching input channel, read the host DAW input channel into the signal array.
    // Note that the 'k_chnl' variable used in the 'inch' opcode is always less than 'nchnls_i'.
    k_chnl = 0
    while (k_chnl < kMaxChannel && k_chnl < nchnls_i) do
        a_signal[k_chnl] = inch(k_chnl + 1)
        k_chnl += 1
    od

    // Output the signals to the host DAW.
    k_chnl = 0
    while (k_chnl < kMaxChannel) do
        outch(k_chnl + 1, a_signal[k_chnl])
        k_chnl += 1
    od

end:
    log_i_info("instr %d - done", p1)
endin


//======================================================================================================================
// Main instrument. Triggered by score and instrument 2.
//======================================================================================================================

${CSOUND_INCLUDE} STRINGIZE(${InstrumentName}.orc)


//======================================================================================================================
// CC processing instrument. Always on.
//
// NB: The instrument number used here should be lower than the instrument number being used to process notes so Csound
// processes CC events before note events.
//
// NB: This instrument uses macros defined in the main instrument .orc file included above.
//======================================================================================================================

instr 2
    iCcCount = giCcCount_$INSTRUMENT_NAME

    log_i_debug("instr 2, CC count = %d", iCcCount)

    // In mode 4 playback, initialize CCs not set to default.
    // NB: The CCs are initialized at 0.01 seconds instead of 0 so they don't get overwritten by the instrument that
    // initializes the CC values at the start.
    if (gk_playing == true && gk_mode == 4 && (changed(gk_mode) == true || changed(gk_playing) == true)) then
        kI = 0
        while (kI < iCcCount) do
            SInstrument = sprintfk("%s_%d_%d", STRINGIZE(${InstrumentName}), gk_trackIndex, gk_pluginIndex - 1)
            if (strcmpk(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_TYPE], "string") == 0) then
                SValue = chngetks(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL])
                SScoreLine = sprintfk("i  %s    0.01 1 %s %d \\\"%s\\\"", SInstrument, "Cc", kI, SValue)
                sendScoreMessage_k(SScoreLine)
            else
                kValue = round(100 * chnget:k(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL])) / 100
                if (kValue != giCcValueDefaults_$INSTRUMENT_NAME[kI]) then
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
        if (strcmpk(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_TYPE], "string") == 0) then
            SPreviousValue = gSCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI]
            SValue = chngetks(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL])
            if (strcmpk(SPreviousValue, SValue) != 0) then
                log_k_debug("String channel '%s' changed from '%s' to '%s'", gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL], SPreviousValue, SValue)
                gSCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] = sprintfk("%s", SValue)
                if (gk_mode == 4) then
                    SInstrument = sprintfk("%s_%d_%d", STRINGIZE(${InstrumentName}), gk_trackIndex, gk_pluginIndex - 1)
                    SScoreLine = sprintfk("i  %s    %.03f 1 %s %d \\\"%s\\\"", SInstrument, elapsedTime_k(), "Cc", kI, SValue)
                    sendScoreMessage_k(SScoreLine)
                else
                    SInstrument = "\"${InstrumentName}\""
                    SScoreLine = sprintfk("i  %s    0 1 %d %d \"%s\"", SInstrument, EVENT_CC, kI, SValue)
                    scoreline(SScoreLine, 1)
                endif
            endif
        else
            kPreviousValue = gkCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI]
            kValue = round(100 * chnget:k(gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL])) / 100
            if (kValue != kPreviousValue) then
                log_k_debug("Channel '%s' changed from '%.02f' to '%.02f'", gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL], kPreviousValue, kValue)
                gkCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] = kValue
                if (gk_mode == 4) then
                    SInstrument = sprintfk("%s_%d_%d", STRINGIZE(${InstrumentName}), gk_trackIndex, gk_pluginIndex - 1)
                    SScoreLine = sprintfk("i  %s    %.03f 1 %s %d %.02f", SInstrument, elapsedTime_k(), "Cc", kI, kValue)
                    sendScoreMessage_k(SScoreLine)
                else
                    SInstrument = "\"${InstrumentName}\""
                    SScoreLine = sprintfk("i  %s    0 1 %d %d %.02f", SInstrument, EVENT_CC, kI, kValue)
                    scoreline(SScoreLine, 1)
                endif
            endif
        endif
        kI += 1
    od
endin


${CSOUND_INCLUDE} "Tab.orc"


//======================================================================================================================

</CsInstruments>
<CsScore>

i1 0 z
i2 0 z
i"${InstrumentName}" 0 z EVENT_EFFECT_ON

</CsScore>
</CsoundSynthesizer>

//======================================================================================================================

<Cabbage>

${form} caption("${InstrumentName}") size(${form_size}) pluginid("0100")

; Track info
${group} bounds(0, 0, ${form_width}, ${TrackInfo_height}) {
    #include "TrackInfo.ui"
}

; Tabs
${group} bounds(${tab_group_rect}) {
    #include "Tab.ui"
}

; Settings tab content
${group} bounds(${tab_content_group_rect}) identchannel("settings_tab_content_ui") visible(1) {
    #include "Spatializer.ui"
}

; Log tab content
${csoundoutput} bounds(${tab_content_group_rect}) identchannel("log_tab_content_ui") visible(0)

</Cabbage>
