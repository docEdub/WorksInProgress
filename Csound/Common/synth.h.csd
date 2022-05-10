#include "definitions.h"

<CsoundSynthesizer>
<CsOptions>

#include "csd_options.h"

</CsOptions>
<CsInstruments>

#define OUT_CHANNEL_COUNT 6

#include "cabbage_synth_global.h"

#define ORC_INSTANCE_INDEX 0 // When a .csd wraps an .orc there's only one orc instance in use at index 0.
${CSOUND_DEFINE} INSTRUMENT_NAME #${InstrumentName}#
${CSOUND_DEFINE} ORC_FILENAME #"${InstrumentName}.orc"#
${CSOUND_DEFINE} CSD_FILE_PATH #__FILE__#
${CSOUND_DEFINE} IS_FIRST_PLUGIN_IN_TRACK #1#
${CSOUND_DEFINE} PLUGIN_TRACK_TYPE #TRACK_TYPE_INSTRUMENT#
${CSOUND_INCLUDE} "af_global.orc"
${CSOUND_INCLUDE} "cabbage_synth_global.orc"
${CSOUND_INCLUDE} "Position_global.orc"
${CSOUND_INCLUDE} "TrackInfo_global.orc"
${CSOUND_INCLUDE} "time.orc"
${CSOUND_INCLUDE} "watchOrcFile.orc"


//======================================================================================================================
// Main processing instrument. Always on.
//======================================================================================================================

instr 1
    ${CSOUND_INCLUDE} "cabbage_core_instr_1_head.orc"
    ${CSOUND_INCLUDE} "TrackInfo_instr_1_head.orc"
    ${CSOUND_INCLUDE} "Position_instr_1_head.orc"
    AF_3D_UpdateListenerRotationMatrix(0.01)
    AF_3D_UpdateListenerPosition(0.01)
endin


//======================================================================================================================
// Main instrument. Triggered by MIDI CC and note processing instruments.
//======================================================================================================================

${CSOUND_INCLUDE} STRINGIZE(${InstrumentName}.orc)


//======================================================================================================================

#include "midi_cc_processing.h.orc"
#include "midi_note_processing.h.orc"
#include "osc_camera_matrix.h.orc"

${CSOUND_INCLUDE} "Tab.orc"


//======================================================================================================================

</CsInstruments>
<CsScore>

i1 0 z

</CsScore>
</CsoundSynthesizer>
<Cabbage>

${form} caption("${InstrumentName}") size(${form_size}) pluginid("0011")

; Track info
${group} bounds(0, 0, ${form_width}, ${TrackInfo_height}) {
    #include "TrackInfo.ui"
}

; Tabs
${group} bounds(${tab_group_rect}) {
    #include "Tab.ui"
}

; S88 tab content
${group} bounds(${tab_content_group_rect}) identchannel("s88_tab_content_ui") visible(1) {
    #include "S88.ui"
}

; Position tab content
${group} bounds(${tab_content_group_rect}) identchannel("position_tab_content_ui") visible(0) {
    #include "Position.ui"
}

; Log tab content
${csoundoutput} bounds(${tab_content_group_rect}) identchannel("log_tab_content_ui") visible(0)

</Cabbage>
