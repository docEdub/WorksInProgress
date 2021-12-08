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
${CSOUND_INCLUDE} "watchOrcFile.orc"


//======================================================================================================================
// Main processing instrument. Always on.
//======================================================================================================================

instr 1
    ${CSOUND_INCLUDE} "cabbage_core_instr_1_head.orc"
    log_i_info("instr %d ...", p1)

    ${CSOUND_INCLUDE} "TrackInfo_instr_1_head.orc"

    log_i_info("nchnls_i = %d", nchnls_i)
    log_i_info("nchnls   = %d", nchnls)

    if (gk_mode == 1) then
        kMaxChannel = 4
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

    log_i_info("instr %d - done", p1)
endin


//======================================================================================================================
// Main instrument. Triggered by score and instrument 2.
//======================================================================================================================

${CSOUND_INCLUDE} STRINGIZE(${InstrumentName}.orc)

#include "midi_cc_processing.h.orc"

${CSOUND_INCLUDE} "Tab.orc"


//======================================================================================================================

</CsInstruments>
<CsScore>

i1 0 z
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

; Reverb tab content
${group} bounds(${tab_content_group_rect}) identchannel("reverb_tab_content_ui") visible(1) {
    #include "Reverb.ui"
}

; Log tab content
${csoundoutput} bounds(${tab_content_group_rect}) identchannel("log_tab_content_ui") visible(0)

</Cabbage>
