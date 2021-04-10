#include <definitions.h>

<CsoundSynthesizer>
<CsOptions>

#include "csd_options.h"

</CsOptions>
<CsInstruments>

#define OUT_CHANNEL_COUNT 6

#include "cabbage_synth_global.h"

#define ORC_INSTANCE_INDEX 0 // When a .csd wraps an .orc there's only one orc instance in use at index 0.
${CSOUND_DEFINE} INSTRUMENT_NAME #${InstrumentName}#
${CSOUND_DEFINE} ORC_FILENAME #STRINGIZE(${InstrumentName}.orc)#
${CSOUND_DEFINE} CSD_FILE_PATH #__FILE__#
${CSOUND_DEFINE} IS_FIRST_PLUGIN_IN_TRACK #1#
${CSOUND_DEFINE} PLUGIN_TRACK_TYPE #TRACK_TYPE_INSTRUMENT#
${CSOUND_INCLUDE} "cabbage_synth_global.orc"
${CSOUND_INCLUDE} "TrackInfo_global.orc"


//======================================================================================================================
// Main processing instrument. Always on.
//======================================================================================================================

instr 1
    ${CSOUND_INCLUDE} "cabbage_core_instr_1_head.orc"
    log_i_info("instr %d ...", p1)
    log_i_info("nchnls = %d", nchnls)

    ${CSOUND_INCLUDE} "TrackInfo_instr_1_head.orc"

    log_i_info("instr %d - done", p1)
endin


//======================================================================================================================
// Main instrument. Triggered by instruments 2 and 3.
//======================================================================================================================

${CSOUND_INCLUDE} STRINGIZE(${InstrumentName}.orc)


//======================================================================================================================
// MIDI CC processing instrument. Always on.
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
            kValue = round(100 * chnget:k(gSCcInfo_$INSTRUMENT_NAME[kI][0])) / 100
            if (gkCcSyncTypes_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] == $CC_SYNC_TO_CHANNEL &&
                    kValue != giCcValueDefaults_$INSTRUMENT_NAME[kI]) then
                SInstrument = sprintfk("%s_%d", STRINGIZE(${InstrumentName}), gk_trackIndex)
                SScoreLine = sprintfk("i  %s    0.01 1 %s %d %.02f", SInstrument, "Cc", kI, kValue)
                sendScoreMessage_k(SScoreLine)
            endif
            kI += 1
        od
    endif

    // Update CCs.
    kI = 0
    while (kI < iCcCount) do
        if (gkCcSyncTypes_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] == $CC_SYNC_TO_CHANNEL) then
            kPreviousValue = gkCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI]
            kValue = round(100 * chnget:k(gSCcInfo_$INSTRUMENT_NAME[kI][0])) / 100

            if (kValue != kPreviousValue) then
                ; log_k_debug("CC %s = %f", gSCcInfo_$INSTRUMENT_NAME[kI][$CC_INFO_CHANNEL], kValue)
                gkCcValues_$INSTRUMENT_NAME[ORC_INSTANCE_INDEX][kI] = kValue

                if (gk_mode == 4) then
                    SInstrument = sprintfk("%s_%d", STRINGIZE(${InstrumentName}), gk_trackIndex)
                    SScoreLine = sprintfk("i  %s    %.03f 1 %s %d %.02f", SInstrument, elapsedTime(), "Cc", kI, kValue)
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


//======================================================================================================================
// MIDI note processing instrument. Triggered by MIDI notes on all channels.
//======================================================================================================================

// Assign all MIDI channels to instr 3.
massign 0, 3

// Disable MIDI program change messages.
// NB: The Apple Logic DAW sends MIDI program change messages on each MIDI track at startup. If they are not disabled,
// Csound will route MIDI messages to instruments other than the one set using `massign`.
pgmassign 0, 0

gi_noteId init 0

instr 3
    gi_noteId += 1
    if (gi_noteId == 1000) then
        gi_noteId = 1
    endif
    i_noteId = gi_noteId

    k_i init 0
    k_i += 1

    k_released = release()
    k_releaseDeltaTime init 1 / kr
    if (k_released == true) then
        if (k_i > 1) then
            k_releaseDeltaTime = 0
        endif
    endif

    if (i(gk_mode) == 1) goto mode_1
    if (i(gk_mode) == 4) goto mode_4
    goto end

    mode_1:
        log_i_info("instr 3, mode_1 ...")
        log_i_debug("gi_noteId = %d", gi_noteId)

        i_instrument = nstrnum(STRINGIZE(${InstrumentName})) + gi_noteId / 1000
        log_i_debug("i_instrument = %.6f", i_instrument)

        event_i("i", i_instrument, 0, -1, EVENT_NOTE_ON, notnum(), veloc())

        if (k_released == true) then
            event("i", -i_instrument, k_releaseDeltaTime, 0)
        endif
        log_i_info("instr 3, mode_1 - done")
        goto end

    mode_4:
        log_i_info("instr 3, mode_4 ...")
        xtratim 2 / kr
        log_i_debug("gi_noteId = %d", gi_noteId)

        // Skip to end if track index is -1 due to mode switch lag.
        if (gk_trackIndex == -1) kgoto end

        k_noteOnSent init false
        if (k_noteOnSent == false) then
            sendScoreMessage_k(sprintfk("i  CONCAT(%s_%d, .%03d) %.03f NoteOn Note(%d) Velocity(%d)",
                STRINGIZE(${InstrumentName}), gk_trackIndex, i_noteId, elapsedTime(), notnum(), veloc()))
            k_noteOnSent = true
        endif

        k_noteOffSent init false
        #if LOG_DEBUG
            if (changed(k_released) == true) then
                log_k_debug("note %d, k_released = %d, k_noteOffSent = %d", gi_noteId, k_released, k_noteOffSent)
            endif
        #endif
        if (k_released == true && k_noteOffSent == false) then
            sendScoreMessage_k(sprintfk("i CONCAT(-%s_%d, .%03d) %.03f NoteOff", STRINGIZE(${InstrumentName}),
                gk_trackIndex, i_noteId, elapsedTime() + k_releaseDeltaTime))
            ; turnoff
            // N.B. The `turnoff` opcode isn't working as expected here so a `k_noteOffSent` flag is used to prevent
            // duplicate scorelines.
            k_noteOffSent = true
        endif
        log_i_info("instr 3, mode_4 - done")
        goto end

    end:
endin


${CSOUND_DEFINE} CC_INDEX(channel) #giCc_${InstrumentName}_$channel#


instr HandleWaveformButtons
    SUiPrefix = strget(p4)
    log_i_info("%s(SUiPrefix = \`%s\`) ...", nstrstr(p1), SUiPrefix)

    SWaveforms[] = fillarray("Saw", "Square", "Pulse", "Noise")
    iWaveformCount = lenarray(SWaveforms)
    SWaveformChannels[] init iWaveformCount
    iI = 0
    while (iI < iWaveformCount) do
        SWaveformChannels[iI] = sprintf("%sWaveform%s", SUiPrefix, SWaveforms[iI])
        log_i_debug("SWaveformChannels[%d] = %s", iI, SWaveformChannels[iI])
        iI += 1
    od

    kI = 0
    kWaveformIndex init 0
    while (kI < iWaveformCount) do
        if (chnget:k(SWaveformChannels[kI]) == true) then
            kWaveformIndex = kI
            kI = iWaveformCount // break
        else
            kI += 1
        endif
    od

    if (changed(kWaveformIndex) == true) then
        log_k_debug("Setting channel %sWaveform to %d", SUiPrefix, kWaveformIndex)
        chnset(kWaveformIndex, sprintfk("%sWaveform", SUiPrefix))
    endif

    log_i_info("%s(SUiPrefix = %s) - done", nstrstr(p1), SUiPrefix)
endin


${CSOUND_INCLUDE} "Position.orc"
${CSOUND_INCLUDE} "Tab.orc"


//======================================================================================================================

</CsInstruments>
<CsScore>

i1 0 z
i2 0 z
i"HandleWaveformButtons" 0 z "osc1"
i"HandleWaveformButtons" 0 z "osc2"
i"HandleWaveformButtons" 0 z "osc3"
i"HandleWaveformButtons" 0 z "osc4"

</CsScore>
</CsoundSynthesizer>

//======================================================================================================================

<Cabbage>

${form} caption("SubtractiveSynth") size(${form_size}) pluginid("0010")

; Track info
${group} bounds(0, 0, ${form_width}, ${TrackInfo_height}) {
    #include "TrackInfo.ui"
}

; Tabs
${group} bounds(${tab_group_rect}) {
    #include "Tab.ui"
}

; S88 tab content
${group} bounds(${tab_content_group_rect}) identchannel("s88_tab_content_ui") visible(0) {
    #include "S88.ui"
}

; Osc 1 tab content
${group} bounds(${tab_content_group_rect}) identchannel("osc1_tab_content_ui") visible(0) {
    ${group} bounds(${tab_content_rect}) {
        #include "SubtractiveSynthOsc1.ui"
    }
}

; Osc 2 tab content
${group} bounds(${tab_content_group_rect}) identchannel("osc2_tab_content_ui") visible(0) {
    ${group} bounds(${tab_content_rect}) {
        #include "SubtractiveSynthOsc2.ui"
    }
}

; Osc 3 tab content
${group} bounds(${tab_content_group_rect}) identchannel("osc3_tab_content_ui") visible(0) {
    ${group} bounds(${tab_content_rect}) {
        #include "SubtractiveSynthOsc3.ui"
    }
}

; Osc 4 tab content
${group} bounds(${tab_content_group_rect}) identchannel("osc4_tab_content_ui") visible(0) {
    ${group} bounds(${tab_content_rect}) {
        #include "SubtractiveSynthOsc4.ui"
    }
}

; Filter tab content
${group} bounds(${tab_content_group_rect}) identchannel("filter_tab_content_ui") visible(0) {
    ${group} bounds(${tab_content_rect}) {
        #include "SubtractiveSynthFilter.ui"
    }
}

; Amplitude tab content
${group} bounds(${tab_content_group_rect}) identchannel("amplitude_tab_content_ui") visible(0) {
    ${group} bounds(${tab_content_rect}) {
        #include "SubtractiveSynthAmplitude.ui"
    }
}

; Position tab content
${group} bounds(${tab_content_group_rect}) identchannel("position_tab_content_ui") visible(1) {
    ${group} bounds(${tab_content_rect}) {
        #include "Position.ui"
    }
}

; Log tab content
${csoundoutput} bounds(${tab_content_group_rect}) identchannel("log_tab_content_ui") visible(0)

</Cabbage>
