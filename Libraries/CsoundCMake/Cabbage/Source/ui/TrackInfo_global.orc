#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: TrackInfo_global.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} TrackInfo_global_orc
${CSOUND_INCLUDE_GUARD_DEFINE} TrackInfo_global_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_INCLUDE} "math.orc"

${CSOUND_IFNDEF} PLUGIN_TRACK_TYPE
    ${CSOUND_DEFINE} PLUGIN_TRACK_TYPE #TRACK_TYPE_NONE#
${CSOUND_ENDIF}

// TODO: Rename `gk_mode` to `gk_dawMode`
gk_mode init 1
gk_playing init false
gk_pluginIndex init -1
gk_trackIndex init -1
gk_trackRefs[] init TRACK_COUNT_MAX


opcode setTrackIndex, 0, k
    k_trackIndex xin
    log_k_info("opcode setTrackIndex(k_trackIndex = %d) ...", k_trackIndex)
    log_k_debug("gk_trackIndex = %d", gk_trackIndex)
    if (gk_trackIndex != k_trackIndex) then
        log_k_debug("Setting gk_trackIndex = %d", k_trackIndex)
        gk_trackIndex = k_trackIndex
        chnsetks(sprintfk("text(%d)", k_trackIndex), "trackIndex_ui")
    endif
    log_k_info("opcode setTrackIndex(k_trackIndex = %d) - done", k_trackIndex)
endop


opcode setPluginIndex, 0, k
    k_pluginIndex xin
    log_k_info("opcode setPluginIndex(k_pluginIndex = %d) ...", k_pluginIndex)
    log_k_debug("gk_pluginIndex = %d", gk_pluginIndex)
    if (gk_pluginIndex != k_pluginIndex) then
        gk_pluginIndex = k_pluginIndex
        chnsetks(sprintfk("text(%d)", k_pluginIndex), "pluginIndex_ui")
    endif
    log_k_info("opcode setPluginIndex(k_pluginIndex = %d) ...", k_pluginIndex)
endop


opcode clearTrackRefs, 0, 0
    i_i = 0
    while (i_i < TRACK_COUNT_MAX) do
        gk_trackRefs[i_i] = false
        i_i += 1
    od
endop


opcode isReferencingTrack, k, k
    k_trackRefIndex xin
    k_out = false
    if (k_trackRefIndex >= 0 && k_trackRefIndex < min(ksmps, TRACK_COUNT_MAX)) then
        k_out = gk_trackRefs[k_trackRefIndex]
    else
        log_k_error("Track reference index %d is out of range [0, %d].", k_trackRefIndex, min(ksmps, TRACK_COUNT_MAX))
    endif
    xout k_out
endop


opcode addTrackRef, 0, k
    k_trackRefIndex xin
    if (k_trackRefIndex >= 0 && k_trackRefIndex < min(ksmps, TRACK_COUNT_MAX)) then
        gk_trackRefs[k_trackRefIndex] = true
    else
        log_k_error("Track reference index %d is out of range [0, %d].", k_trackRefIndex, min(ksmps, TRACK_COUNT_MAX))
    endif
endop


// A separate instrument needs to be used for the Csound `readk` opcode because setting the `period` argument to zero
// causes Reaper to crash? (When this happened it might have been unrelated to the `period` argument being zero).
// TODO: Investigate. Does the `readk` opcode really crash Reaper when the `period` argument is zero?
//
instr ReadMode
    log_ik_info("%s ...", nstrstr(p1))
    gk_mode = readk("${CSOUND_CMAKE_OUTPUT_DIR}/mode.txt", 8, 1)
    log_k_info("Mode = %d", gk_mode)
    log_ik_info("%s - done", nstrstr(p1))
    turnoff
endin


gi_oscHandle init -1
gi_oscPort init TRACK_INFO_OSC_PORT_MIN


instr InitializeOSC
    log_i_debug("Trying port %d", gi_oscPort)

    // Increment the global osc port number before trying to initialize OSC, so if it errors out and kills this note
    // then the next port will be tried next time instead of trying the same port over and over again.
    gi_oscPort += 1

    // The `OSCinit` opcode only works in the Csound global instrument, which can be accessed from this instrument
    // using the `evalstr` opcode.
    log_i_trace("gi_oscHandle initialized to %d", gi_oscHandle)
    i_ = evalstr(sprintf("gi_oscHandle OSCinit %d", gi_oscPort - 1))
    log_i_trace("gi_oscHandle set to %d", gi_oscHandle)

    // The global osc port number was incremented earlier in this instrument. If OSC initialization succeeded, roll
    // the global osc port number back.
    if (gi_oscHandle != -1) then
        gi_oscPort -= 1
    endif

    turnoff
endin


instr GetTrackIndex
    log_i_info("GetTrackIndex ...")

    if (gi_oscHandle == -1) then
        event_i "i", "InitializeOSC", 0, -1
        event_i "i", "GetTrackIndex", 0, -1
        log_k_info("GetTrackIndex - turnoff")
        turnoff
    else
        log_i_debug("gi_oscHandle = %d", gi_oscHandle)
        k_trackIndex init 0
        k_received = OSClisten(gi_oscHandle, sprintf("%s/%d", TRACK_INFO_OSC_TRACK_SET_INDEX_PATH, gi_oscPort), "i",
            k_trackIndex)
        if (k_received == true) then
            log_k_debug("Track index received on port = %d (trackIndex = %d)", gi_oscPort, k_trackIndex)
            setTrackIndex(k_trackIndex)
            log_k_info("GetTrackIndex - turnoff")
            turnoff
        endif
        k_time = timeinsts()
        k_lastTime init 0
        if (k_lastTime == 0 || (k_time - k_lastTime) > 1) then
            if (k_lastTime > 0) then
                log_k_debug("No response. Trying again ...")
            endif
            k_lastTime = k_time
            event "i", "RegisterTrack", 0, 1
        endif
    endif

    log_i_info("GetTrackIndex - endin")
endin


instr RegisterTrack
    log_ik_info("RegisterTrack ...")

    OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_TRACK_REGISTRATION_PATH, "iiss",
        gi_oscPort, $PLUGIN_TRACK_TYPE, $ORC_FILENAME, "$INSTRUMENT_NAME")

    log_ik_info("RegisterTrack - done")
    turnoff
endin


instr RegisterPlugin
    log_ik_info("%s ...", nstrstr(p1))
    log_k_debug("gk_trackIndex = %d, gk_pluginIndex = %d", gk_trackIndex, gk_pluginIndex)

    OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_PLUGIN_REGISTRATION_PATH, "iiss",
        gk_trackIndex, gk_pluginIndex, $ORC_FILENAME, "$INSTRUMENT_NAME")

    log_ik_info("%s - done", nstrstr(p1))
    turnoff
endin

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
