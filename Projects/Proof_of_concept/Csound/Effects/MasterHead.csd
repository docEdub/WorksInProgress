#include <definitions.h>

<CsoundSynthesizer>
<CsOptions>

#include "core-options.h"

</CsOptions>
<CsInstruments>

#define IN_CHANNEL_COUNT 6
#define OUT_CHANNEL_COUNT 6

#include "cabbage-effect-global.h"

${CSOUND_DEFINE} INSTRUMENT_NAME #${InstrumentName}#
${CSOUND_DEFINE} ORC_FILENAME #STRINGIZE(${InstrumentName}.orc)#
${CSOUND_DEFINE} CSD_FILE_PATH #__FILE__#
${CSOUND_DEFINE} IS_FIRST_PLUGIN_IN_TRACK #1#
${CSOUND_DEFINE} IS_BUS_PLUGIN #1#
${CSOUND_DEFINE} IS_MASTER_BUS_PLUGIN #1#
${CSOUND_DEFINE} PLUGIN_TRACK_TYPE #TRACK_TYPE_MASTER#
${CSOUND_INCLUDE} "cabbage-effect-global.orc"
${CSOUND_INCLUDE} "cabbage/TrackInfo-global.orc"
${CSOUND_INCLUDE} "source/main/global.orc" // For spatial-audio global variables and opcodes.


//======================================================================================================================
// Main processing instrument. Always on.
//======================================================================================================================

instr 1
    ${CSOUND_INCLUDE} "cabbage-core-instr-1-head.orc"
    log_i_info("instr %d ...", p1)

    ${CSOUND_INCLUDE} "cabbage/TrackInfo-instr-1-head.orc"

    log_i_info("nchnls_i = %d", nchnls_i)
    log_i_info("nchnls   = %d", nchnls)

    // Create an array of signals. 1 for each output channel.
    a_signal[] init nchnls

    // For each output channel that has a matching input channel, read the host DAW input channel into the signal array.
    // Note that the `k_chnl` variable used in the `inch` opcode is always less than `nchnls_i`.
    k_chnl = 0
    while (k_chnl < nchnls && k_chnl < nchnls_i) do
        a_signal[k_chnl] = inch(k_chnl + 1)
        k_chnl += 1
    od

    // Update the listener rotation matrix before using it to convert from ambisonic to binaural.
    AF_3D_UpdateListenerRotationMatrix($AF_3D_FRAME_DURATION_OVER_2)

    // Output the signals to the host DAW.
    if (nchnls_i == 6 && nchnls == 6) then
        // Assume channels 1-4 are for first order ambisonics, with channels 5 and 6 for reverb left and right.

        // Convert output ambisonic channels 1-4 to binaural and send the output to channels 1 and 2.
        aw = a_signal[0]
        ay = a_signal[1]
        az = a_signal[2]
        ax = a_signal[3]
        km0 = gk_AF_3D_ListenerRotationMatrix[0]
        km1 = gk_AF_3D_ListenerRotationMatrix[1]
        km2 = gk_AF_3D_ListenerRotationMatrix[2]
        km3 = gk_AF_3D_ListenerRotationMatrix[3]
        km4 = gk_AF_3D_ListenerRotationMatrix[4]
        km5 = gk_AF_3D_ListenerRotationMatrix[5]
        km6 = gk_AF_3D_ListenerRotationMatrix[6]
        km7 = gk_AF_3D_ListenerRotationMatrix[7]
        km8 = gk_AF_3D_ListenerRotationMatrix[8]
        ayr = -(ay * km0 + az * km3 + ax * km6)
        azr =   ay * km1 + az * km4 + ax * km7
        axr = -(ay * km2 + az * km5 + ax * km8)

        // Use sh_hrir_order_1.wav to convert ambisonic output to stereo.
        i_hrir_0 = ftgen(0, 0, 0, 1, "../../3rdparty/resonance-audio/1.0.0/sh_hrir_order_1.wav", 0, 0, 1)
        i_hrir_1 = ftgen(0, 0, 0, 1, "../../3rdparty/resonance-audio/1.0.0/sh_hrir_order_1.wav", 0, 0, 2)
        i_hrir_2 = ftgen(0, 0, 0, 1, "../../3rdparty/resonance-audio/1.0.0/sh_hrir_order_1.wav", 0, 0, 3)
        i_hrir_3 = ftgen(0, 0, 0, 1, "../../3rdparty/resonance-audio/1.0.0/sh_hrir_order_1.wav", 0, 0, 4)
        aw dconv aw, 256, i_hrir_0
        ay dconv ayr, 256, i_hrir_1
        az dconv azr, 256, i_hrir_2
        ax dconv axr, 256, i_hrir_3

        outch(1, aw - ay + az + ax)
        outch(2, aw + ay + az + ax)

        // Output reverb channels 5 and 6.
        outch(5, a_signal[4])
        outch(6, a_signal[5])
    else
        // All channel configurations other than 6 are not supported, yet, so just output the signal to all available
        // channels for now.
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

${form} caption("TestMasterHead") size(${form_width}, ${form_height}) pluginid("0004")

${group} bounds(0, 0, ${form_width}, ${TrackInfo_height}) {
#include "${CSOUND_CMAKE_OUTPUT_SUBDIRECTORY}/cabbage/TrackInfo.ui"
}

${csoundoutput} bounds(${csoundoutput_group_rect})

</Cabbage>
