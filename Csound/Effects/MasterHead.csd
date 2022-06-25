#include "definitions.h"

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
${CSOUND_DEFINE} IS_MASTER_BUS_PLUGIN #1#
${CSOUND_DEFINE} PLUGIN_TRACK_TYPE #TRACK_TYPE_MASTER#
${CSOUND_INCLUDE} "cabbage_effect_global.orc"
${CSOUND_INCLUDE} "TrackInfo_global.orc"
${CSOUND_INCLUDE} "af_global.orc" // For spatial-audio global variables and opcodes.


//======================================================================================================================
// Main processing instrument. Always on.
//======================================================================================================================

instr 1
    ${CSOUND_INCLUDE} "cabbage_core_instr_1_head.orc"
    log_i_info("instr %d ...", p1)

    ${CSOUND_INCLUDE} "TrackInfo_instr_1_head.orc"

    log_i_info("nchnls_i = %d", nchnls_i)
    log_i_info("nchnls   = %d", nchnls)

    // Create an array of signals. 1 for each output channel.
    a_signal[] init nchnls

    // For each output channel that has a matching input channel, read the host DAW input channel into the signal array.
    // Note that the 'k_chnl' variable used in the 'inch' opcode is always less than 'nchnls_i'.
    k_chnl = 0
    while (k_chnl < nchnls && k_chnl < nchnls_i) do
        a_signal[k_chnl] = inch(k_chnl + 1)
        k_chnl += 1
    od

    // Update the listener rotation matrix before using it to convert from ambisonic to binaural.
    AF_3D_UpdateListenerRotationMatrix()

    // Output the signals to the host DAW.
    if (nchnls_i == 6 && nchnls == 6) then
        // Assume channels 1-4 are for first order ambisonics, with channels 5 and 6 for reverb left and right.

        // Convert output ambisonic channels 1-4 to binaural and send the output to channels 1 and 2.
        aw = a_signal[0]
        ay = a_signal[1]
        az = a_signal[2]
        ax = a_signal[3]
        am0 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[0]), $AF_3D_LISTENER_LAG_TIME)
        am1 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[1]), $AF_3D_LISTENER_LAG_TIME)
        am2 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[2]), $AF_3D_LISTENER_LAG_TIME)
        am3 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[3]), $AF_3D_LISTENER_LAG_TIME)
        am4 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[4]), $AF_3D_LISTENER_LAG_TIME)
        am5 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[5]), $AF_3D_LISTENER_LAG_TIME)
        am6 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[6]), $AF_3D_LISTENER_LAG_TIME)
        am7 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[7]), $AF_3D_LISTENER_LAG_TIME)
        am8 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[8]), $AF_3D_LISTENER_LAG_TIME)
        ayr = -(ay * am0 + az * am3 + ax * am6)
        azr =   ay * am1 + az * am4 + ax * am7
        axr = -(ay * am2 + az * am5 + ax * am8)
        iHrirLength = ftlen(gi_AF_3D_HrirChannel1TableNumber)
        aw ftconv aw, gi_AF_3D_HrirChannel1TableNumber, iHrirLength
        ay ftconv ayr, gi_AF_3D_HrirChannel2TableNumber, iHrirLength
        az ftconv azr, gi_AF_3D_HrirChannel3TableNumber, iHrirLength
        ax ftconv axr, gi_AF_3D_HrirChannel4TableNumber, iHrirLength
        outch(1, aw + ay + az + ax)
        outch(2, aw - ay + az + ax)

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

    ki init 0
    ki += 1

    kSendHeartbeat = metro(4)
    if (kSendHeartbeat == true) then
        OSCsend(ki, BROWSER_OSC_ADDRESS, BROWSER_OSC_PORT, "/daw/heartbeat", "i", 0)
    endif

    kDawIsPlaying = chnget:k("IS_PLAYING")
    OSCsend(ki, BROWSER_OSC_ADDRESS, BROWSER_OSC_PORT, "/daw/is_playing", "i", kDawIsPlaying)

    kDawTimeInSeconds = chnget:k("TIME_IN_SECONDS")
    OSCsend(ki, BROWSER_OSC_ADDRESS, BROWSER_OSC_PORT, "/daw/time_in_seconds", "f", kDawTimeInSeconds)

    log_i_info("instr %d - done", p1)
endin

#include "osc_camera_matrix.h.orc"

//======================================================================================================================

</CsInstruments>
<CsScore>

i1 0 z

</CsScore>
</CsoundSynthesizer>
<Cabbage>

${form} caption("${InstrumentName}") size(${form_width}, ${form_height}) pluginid("0004")

${group} bounds(0, 0, ${form_width}, ${TrackInfo_height}) {
    #include "TrackInfo.ui"
}

${csoundoutput} bounds(${csoundoutput_group_rect})

</Cabbage>
