#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: TrackInfo_instr_1_head.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} TrackInfo_instr_1_head_orc
${CSOUND_INCLUDE_GUARD_DEFINE} TrackInfo_instr_1_head_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

    log_i_trace("Calling instr `ReadMode` ...")
    event_i("i", "ReadMode", 0, -1)

    ${CSOUND_IFDEF} IS_FIRST_PLUGIN_IN_TRACK
        log_i_trace("Calling instr `GetTrackIndex` ...")
        if (gk_i == 0) then
            event("i", "GetTrackIndex", 0, -1)
            setPluginIndex(0)
        endif
    ${CSOUND_ENDIF}

    if (changed(gk_playing) == true) then
        event("i", "ReadMode", 0, -1)
    endif

    if (changed(gk_mode) == true) then
        log_k_info("gk_mode changed to %d", gk_mode)
        chnsetks("colour(${dark_grey})", "mode_label_1_ui")
        chnsetks("colour(${dark_grey})", "mode_label_2_ui")
        chnsetks("colour(${dark_grey})", "mode_label_3_ui")
        chnsetks("colour(${dark_grey})", "mode_label_4_ui")
        if (gk_mode == 1) then
            chnsetks("colour(${dark_green})", "mode_label_1_ui")
        elseif (gk_mode == 2) then
            chnsetks("colour(${red})", "mode_label_2_ui")
        elseif (gk_mode == 3) then
            chnsetks("colour(${red})", "mode_label_3_ui")
        elseif (gk_mode == 4) then
            chnsetks("colour(${red})", "mode_label_4_ui")
        endif
    endif

    kModeChanged = changed(gk_mode)
    kPlayingChanged = changed(gk_playing)

    if (kModeChanged == true) then
        log_k_debug("mode changed")
    endif
    if (kPlayingChanged == true) then
        log_k_debug("playing changed")
    endif

    // Delay the gk_playing flag by 2 k-passes to give the mode variable enough time to update.
    k_playing init false
    k_delayPlayingPass init 0
    if (gk_playing == true && kPlayingChanged == true && kModeChanged == false) then
        k_playing = false
        k_delayPlayingPass = 3
        log_k_debug("delaying playing ...")
    elseif (k_delayPlayingPass > 0) then
        k_delayPlayingPass -= 1
        if (k_delayPlayingPass == 0) then
            k_playing = true
            log_k_debug("delaying playing - done")
        endif
    else
        k_playing = gk_playing
    endif

    if (gk_mode == 2 && k_playing == true) then
        // Sample 1 is the track index.
        // Sample 2 is the plugin index.
        ${CSOUND_DEFINE} TRACK_INDEX #0#
        ${CSOUND_DEFINE} PLUGIN_INDEX #1#
        a_indexes init 0
        k_trackIndexSignal init 0
        k_pluginIndexSignal init 0

        ${CSOUND_IFDEF} IS_FIRST_PLUGIN_IN_TRACK
            // Re-register the track index with the DAW service if the mode changed or the DAW play state changed.
            if (kModeChanged == true || kPlayingChanged == true) then
                log_k_trace("kModeChanged == true || kPlayingChanged == true")
                gk_trackIndex = -1
                event("i", "GetTrackIndex", 0, -1)
            endif

            // Generate the track index signal.
            if (changed(gk_trackIndex) == true) then
                k_trackIndexSignal = PLUGIN_INDEX_TRACKING_INDEX_TO_SIGNAL(gk_trackIndex)
            endif

            // Initialize the signal downtream plugins in the same track use to determine their plugin index.
            k_pluginIndexSignal = 0
        ${CSOUND_ELSE}
            // Plugins other than the first read the track index signal and pass it downstream without changing it.
            a_indexes = inch(1)
            k_trackIndex = PLUGIN_INDEX_TRACKING_SIGNAL_TO_INDEX(vaget($TRACK_INDEX, a_indexes))
            // Track indexes larger than ksmps are probably samples from a different mode. Reject them.
            // TODO: Come up with a better way to deal with the mode switch lag causing this track index issue.
            //       This might require changing the way the mode is received from the DAW service. It's done via file,
            //       now. It might have to be done via OSC to fix this. Or maybe reading from the file can be made
            //       reliable enough to use directly instead of requiring an instrument call in case the file read
            //       fails. For now it can be worked around by making sure the DAW sequence begins with silence after
            //       switching modes.
            if (k(0) <= k_trackIndex && abs(k_trackIndex) < ksmps) then
                if (k_trackIndex != gk_trackIndex) then
                    setTrackIndex(k_trackIndex)
                endif
            endif

            // Determine this plugin's index using the plugin index signal, then increment the signal and pass it
            // downstream.
            k_pluginIndex = PLUGIN_INDEX_TRACKING_SIGNAL_TO_INDEX(vaget($PLUGIN_INDEX, a_indexes)) + 1
            if (k_pluginIndex != gk_pluginIndex) then
                setPluginIndex(k_pluginIndex)
            endif

            k_pluginIndexSignal = PLUGIN_INDEX_TRACKING_INDEX_TO_SIGNAL(gk_pluginIndex)

            // Register/update the plugin index.
            kRegisteredPlugin init false
            if (kModeChanged == true || changed(k_playing) == true || changed(gk_trackIndex) == true
                    || changed(gSPluginUuid) == true) then
                kRegisteredPlugin = false
            endif
            if (kRegisteredPlugin == false && gk_trackIndex >= 0 && gk_pluginIndex > 0
                    && strlenk(gSPluginUuid) > 0) then
                event("i", "RegisterPlugin", 0, -1)
                kRegisteredPlugin = true
            endif
       ${CSOUND_ENDIF}
 
        vaset(k_trackIndexSignal, $TRACK_INDEX, a_indexes)
        vaset(k_pluginIndexSignal, $PLUGIN_INDEX, a_indexes)
        outch(1, a_indexes)
    endif

    ${CSOUND_IFDEF} IS_FIRST_PLUGIN_IN_TRACK
        if (gk_mode == 3 && k_playing == true) then
            if (gk_trackIndex < 0) then
                // Don't print this message over and over again on each k pass. Only print it if this branch of code
                // wasn't taken on the last k pass.
                kLastPrintK init 0
                if (kLastPrintK + 1 < gk_i) then
                    log_k_warning("Track index %d is less than zero. Mode 3 does not work in this case.", gk_trackIndex)
                endif
                kLastPrintK = gk_i
            elseif (ksmps <= gk_trackIndex) then
                log_k_fatal("Track index %d is greater than ksmps. Mode 3 does not work in this case. Increase ksmps.",
                    gk_trackIndex)
                turnoff
            else
                // Output the track volume signal.
                // This needs to be done by all plugins that are first in a track or bus.
                a_outVolumes[] init nchnls
                k_channel = 0
                while (k_channel < nchnls) do
                    a_outVolume = 0
                    vaset(k(VOLUME_TRACKING_SIGNAL), gk_trackIndex, a_outVolume)
                    outch(k_channel + 1, a_outVolume)
                    k_channel += 1
                od

                // If this plugin is a bus, send score messages for every track channel volume change detected, and
                // send track reference messages for any track that sends a value greater than zero.
                ${CSOUND_IFDEF} IS_BUS_PLUGIN
                    i_maxTracks = min(TRACK_COUNT_MAX, ksmps)
                    a_inVolumes[] init nchnls_i
                    k_volumes[][] init i_maxTracks, nchnls_i
                    k_channel = 0
                    if (kModeChanged == true || kPlayingChanged == true) then
                        clearTrackRefs()

                        // Clear track volumes.
                        k_track = 0
                        while (k_track < i_maxTracks) do
                            k_channel = 0
                            while (k_channel < nchnls_i) do
                                k_volumes[k_track][k_channel] = 0
                                k_channel += 1
                            od
                            k_track += 1
                        od
                    endif
                    while (k_channel < nchnls_i) do
                        a_inVolumes[k_channel] = inch(k_channel + 1)
                        k_channel += 1
                    od
                    k_track = 0
                    while (k_track < i_maxTracks) do
                        k_channel = 0
                        while (k_channel < nchnls_i) do
                            k_volume = math_roundFloat_k(vaget(k_track, VOLUME_TRACKING_SIGNAL_TO_VOLUME(
                                a_inVolumes[k_channel])), 2)
                            if (k_volume != k_volumes[k_track][k_channel]) then
                                k_volumes[k_track][k_channel] = k_volume
                                ${CSOUND_IFDEF} IS_MASTER_BUS_PLUGIN
                                    log_k_debug("Master: track %d, channel %d set to %.2f", k_track, k_channel,
                                        k_volume)
                                    sendScoreMessage_k(sprintfk(
                                        "i MasterInstrument %.03f 1 Track(%d) Channel(%d) Volume(%.2f)", elapsedTime(),
                                        k_track, k_channel, k_volume))
                                ${CSOUND_ELSE}
                                    log_k_debug("Bus: track %d, channel %d set to %.2f", k_track, k_channel, k_volume)
                                    sendScoreMessage_k(sprintfk(
                                        "i AuxInstrument %.03f 1 Aux(%d) Track(%d) Channel(%d) Volume(%.2f)",
                                        elapsedTime(), gk_trackIndex, k_track, k_channel, k_volume))
                                ${CSOUND_ENDIF}
                                if (isReferencingTrack(k_track) == false) then
                                    addTrackRef(k_track)
                                    sendTrackReferenceMessage_k(gk_trackIndex, k_track)
                                endif
                            endif
                            k_channel += 1
                        od
                        k_track += 1
                    od
                ${CSOUND_ENDIF}
            endif
        endif
    ${CSOUND_ENDIF}

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_ENDIF}
