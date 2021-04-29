#include <definitions.h>

<CsoundSynthesizer>
<CsOptions>

#include "csd_options.h"

</CsOptions>
<CsInstruments>

#define IN_CHANNEL_COUNT 6
#define OUT_CHANNEL_COUNT 6

#include "cabbage_effect_global.h"

${CSOUND_DEFINE} INSTRUMENT_NAME #${InstrumentName}#
${CSOUND_DEFINE} ORC_FILENAME #"${InstrumentName}.orc"#
${CSOUND_DEFINE} CSD_FILE_PATH #__FILE__#
${CSOUND_DEFINE} IS_FIRST_PLUGIN_IN_TRACK #1#
${CSOUND_DEFINE} IS_BUS_PLUGIN #1#
${CSOUND_DEFINE} PLUGIN_TRACK_TYPE #TRACK_TYPE_BUS#
${CSOUND_INCLUDE} "cabbage_effect_global.orc"
${CSOUND_INCLUDE} "TrackInfo_global.orc"


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
        // Create an array of signals. 1 for each output channel.
        a_signal[] init nchnls

        // For each output channel that has a matching input channel, read the host DAW input channel into the signal array.
        // Note that the `k_chnl` variable used in the `inch` opcode is always less than `nchnls_i`.
        k_chnl = 0
        while (k_chnl < nchnls && k_chnl < nchnls_i) do
            a_signal[k_chnl] = inch(k_chnl + 1)
            k_chnl += 1
        od

        // Output the signals to the host DAW.
        k_chnl = 0
        while (k_chnl < nchnls) do
            outch(k_chnl + 1, a_signal[k_chnl])
            k_chnl += 1
        od
    endif

    log_i_info("instr %d - done", p1)
endin

//======================================================================================================================

</CsInstruments>
<CsScore>

i1 0 z

</CsScore>
</CsoundSynthesizer>
<Cabbage>

${form} caption("${InstrumentName}") size(${form_width}, ${form_height}) pluginid("0003")

${group} bounds(0, 0, ${form_width}, ${TrackInfo_height}) {
    #include "TrackInfo.ui"
}

${csoundoutput} bounds(${csoundoutput_group_rect})

</Cabbage>
