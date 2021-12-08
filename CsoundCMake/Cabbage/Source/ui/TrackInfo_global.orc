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

// TODO: Rename 'gk_mode' to 'gk_dawMode'
gk_mode init 1
gk_playing init false
gk_pluginIndex init -1
gk_trackIndex init -1
gk_trackRefs[] init TRACK_COUNT_MAX
gSPluginUuid init ""


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


opcode setPluginUuid, 0, S
    SPluginUuid xin
    gSPluginUuid = SPluginUuid
endop


// A separate instrument needs to be used for the Csound 'readk' opcode because setting the 'period' argument to zero
// causes Reaper to crash? (When this happened it might have been unrelated to the 'period' argument being zero).
// TODO: Investigate. Does the 'readk' opcode really crash Reaper when the 'period' argument is zero?
//
instr ReadMode
    log_ik_info("%s ...", nstrstr(p1))
    gk_mode = readk("${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}/_.mode.txt", 8, 1)
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

    // The 'OSCinit' opcode only works in the Csound global instrument, which can be accessed from this instrument
    // using the 'evalstr' opcode.
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


instr InitializePlugin
    log_i_info("InitializePlugin ...")

    if (gi_oscHandle == -1) then
        event_i("i", "InitializeOSC", 0, -1)
        event_i("i", "InitializePlugin", 0, -1)
    else
        event_i("i", "GetPluginUuid", 0, -1, 1)
        ${CSOUND_IFDEF} IS_FIRST_PLUGIN_IN_TRACK
            setPluginIndex(0)
            event_i("i", "GetTrackIndex", 0, -1)
        ${CSOUND_ENDIF}
    endif
    turnoff

    log_i_info("InitializePlugin - done")
endin


instr GetTrackIndex
    log_i_info("GetTrackIndex ...")

    if (gi_oscHandle == -1) then
        event_i("i", "GetTrackIndex", 0, -1)
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
    log_ik_info("%s ...", nstrstr(p1))

    if (strlen(gSPluginUuid) != 0) then
        log_k_trace("Sending track registration to DAW ...")
        log_k_trace("gSPluginUuid = %s", gSPluginUuid)
        log_k_trace("gi_oscPort = %d", gi_oscPort)
        OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_TRACK_REGISTRATION_PATH, "iissss",
            gi_oscPort, $PLUGIN_TRACK_TYPE, $ORC_FILENAME, "$INSTRUMENT_NAME", gS_instanceName, gSPluginUuid)
        log_k_trace("Sending track registration to DAW - done")
    else
        log_k_trace("gsPluginUuid length == 0")
        event_i("i", p1, CABBAGE_CHANNEL_INIT_TIME_SECONDS, -1)
    endif

    log_ik_info("%s - done", nstrstr(p1))
    turnoff
endin


instr RegisterPlugin
    log_ik_info("%s ...", nstrstr(p1))
    log_k_debug("gk_trackIndex = %d, gk_pluginIndex = %d, gSPluginUuid = '%s'", gk_trackIndex, gk_pluginIndex, gSPluginUuid)

    if (gk_trackIndex != -1 && gk_pluginIndex != -1 && strlen(gSPluginUuid) != 0) then
        OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_PLUGIN_REGISTRATION_PATH, "iiss",
            gk_trackIndex, gk_pluginIndex, $ORC_FILENAME, gSPluginUuid)
    else
        event("i", p1, 1, -1)
    endif

    log_ik_info("%s - done", nstrstr(p1))
    turnoff
endin


instr ListenForPluginUuid
    log_i_trace("instr ListenForPluginUuid ...")

    SUuid init ""
    kReceived = OSClisten(gi_oscHandle, sprintf("%s/%d", TRACK_INFO_OSC_PLUGIN_SET_UUID_PATH, gi_oscPort), "s", SUuid)
    if (kReceived == true) then
        gSPluginUuid = sprintfk("%s", SUuid)
        log_k_debug("Heard gSPluginUuid = %s", gSPluginUuid)
        chnsetks(sprintfk("text(\"%s\")", gSPluginUuid), "pluginUuid_ui")
        turnoff
    endif

    log_i_trace("instr ListenForPluginUuid - done")
endin


instr RequestPluginUuid
    log_i_trace("instr RequestPluginUuid ...")

    if (gi_oscHandle == -1) then
        log_k_trace("Request not sent. (gi_oscHandle == -1).")
        event("i", p1, CABBAGE_CHANNEL_INIT_TIME_SECONDS, -1)
    else
        log_i_debug("Requesting plugin uuid on port %d", gi_oscPort)
        OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_PLUGIN_REQUEST_UUID_PATH, "i",
            gi_oscPort)
        event("i", "ListenForPluginUuid", 0, -1)
    endif

    turnoff
    log_i_trace("instr RequestPluginUuid - done")
endin


instr SuggestPluginUuid
    SSuggestedPluginUuid = strget(p4)

    log_ik_trace("%s('%s') ...", nstrstr(p1), SSuggestedPluginUuid)

    if (gi_oscHandle == -1) then
        log_k_trace("Request not sent. (gi_oscHandle == -1).")
        event("i", p1, CABBAGE_CHANNEL_INIT_TIME_SECONDS, -1)
    else
        log_i_debug("Requesting plugin uuid on port %d", gi_oscPort)
        OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_PLUGIN_SUGGEST_UUID_PATH, "is",
            gi_oscPort, SSuggestedPluginUuid)
        event("i", "ListenForPluginUuid", 0, -1)
    endif
    
    log_ik_trace("%s('%s') - done", nstrstr(p1), SSuggestedPluginUuid)
    turnoff
endin


instr GetPluginUuid
    iAttempt = p4

    log_ik_trace("%s attempt = %d ...", nstrstr(p1), iAttempt)
    log_k_debug("gk_trackIndex = %d, gk_pluginIndex = %d", gk_trackIndex, gk_pluginIndex)

    if (strlen(gSPluginUuid) == 0) then
        if (iAttempt >= 3) then
            log_i_trace("Requesting plugin UUID ...")
            event("i", "RequestPluginUuid", 0, -1)
            log_i_trace("Requesting plugin UUID - done")
        else
            log_i_trace("Getting plugin UUID from channel ...")
            SPluginUuid = chnget:S("pluginUuid")
            if (strlen(SPluginUuid) == 0) then
                event_i("i", p1, CABBAGE_CHANNEL_INIT_TIME_SECONDS, -1, iAttempt + 1)
            else
                log_i_trace("Plugin UUID from channel 'pluginUuid' is '%s'", SPluginUuid)
                scoreline(sprintfk("i \"SuggestPluginUuid\" 0 -1 \"%s\"", SPluginUuid), 1)
            endif
        endif
    else
        log_i_warning("gSPluginUuid already set to %s", gSPluginUuid)
    endif

    log_ik_trace("%s attempt = %d - done", nstrstr(p1), iAttempt)
    turnoff
endin


${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
