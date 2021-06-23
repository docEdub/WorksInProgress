#include <definitions.h>

<CsoundSynthesizer>
<CsOptions>

--env:INCDIR=${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}
--messagelevel=${CSOUND_MESSAGE_LEVEL}
--midi-device=0
--nodisplays
--nosound
-+rtmidi=null

</CsOptions>
<CsInstruments>

#include "core_global.h"

// Override core_global.h ksmps.
kr = 1000

pyinit

// Turn off redundant OSC logging.
#define DISABLE_LOGGING_TO_DAW_SERVICE

${CSOUND_DEFINE} CSD_FILE_PATH #__FILE__#
${CSOUND_DEFINE} INSTANCE_NAME #"DawService"#
${CSOUND_INCLUDE} "core_global.orc"
${CSOUND_INCLUDE} "time.orc"
${CSOUND_INCLUDE} "uuid.orc"


// TODO: Rename 'gk_mode' to 'gk_dawMode'
gk_mode init 0
gS_mode_channels[] = fillarray("mode-1", "mode-2", "mode-3", "mode-4")

gi_trackPorts[] init TRACK_COUNT_MAX
gi_trackTypes[] init TRACK_COUNT_MAX
gS_trackOrcPaths[] init TRACK_COUNT_MAX
gS_trackInstrumentNames[] init TRACK_COUNT_MAX
gSInstanceNames[] init TRACK_COUNT_MAX
gSTrackUuids[] init TRACK_COUNT_MAX
gi_trackRefs[][] init TRACK_COUNT_MAX, TRACK_COUNT_MAX
gi_masterRefs[] init TRACK_COUNT_MAX

giTracksetOrder[] init TRACK_COUNT_MAX
giTracksetCount init 0

gSOrcInstances[] init TRACK_COUNT_MAX
giOrcInstanceCounts[] init TRACK_COUNT_MAX
gkOrcInstanceCounters[] init TRACK_COUNT_MAX

gSPlugins[][] init TRACK_COUNT_MAX, PLUGIN_COUNT_MAX
gSPluginUuids[][] init TRACK_COUNT_MAX, PLUGIN_COUNT_MAX


opcode clearTracks, 0, 0
    log_ik_info("opcode clearTracks() ...")
    i_i = 0
    while (i_i < TRACK_COUNT_MAX) do
        gi_trackPorts[i_i] = 0
        gi_trackTypes[i_i] = TRACK_TYPE_NONE
        gS_trackOrcPaths[i_i] = ""
        gSTrackUuids[i_i] = ""
        i_j = 0
        while (i_j < TRACK_COUNT_MAX) do
            gi_trackRefs[i_i][i_j] = false
            i_j += 1
        od
        gi_masterRefs[i_i] = false
        i_i += 1
    od
    log_ik_info("opcode clearTracks() - done")
endop


opcode clearPlugins, 0, 0
    log_ik_info("opcode clearPlugins() ...")
    iI = 0
    while (iI < TRACK_COUNT_MAX) do
        iJ = 0
        while (iJ < PLUGIN_COUNT_MAX) do
            gSPlugins[iI][iJ] = ""
            gSPluginUuids[iI][iJ] = ""
            iJ += 1
        od
        iI += 1
    od
    log_ik_info("opcode clearPlugins() - done")
endop


opcode getNextTrackIndex, i, 0
    log_i_info("opcode getNextTrackIndex() ...")
    i_i = 0
    i_returnValue = -1
    while (i_i < TRACK_COUNT_MAX && i_returnValue == -1) do
        if (gi_trackPorts[i_i] == 0) then
            i_returnValue = i_i
        else
            i_i += 1
        endif
    od
    log_i_info("opcode getNextTrackIndex() - done => %d", i_returnValue)
    xout i_returnValue
endop


opcode getTrackIndexForPort, i, i
    i_port xin
    log_i_info("opcode getTrackIndexForPort(i_port = %d) ...", i_port)
    i_i = 0
    i_returnValue = -1
    while (i_i < TRACK_COUNT_MAX && i_returnValue == -1) do
        if (gi_trackPorts[i_i] == i_port) then
            i_returnValue = i_i
        else
            i_i += 1
        endif
    od
    log_i_info("opcode getTrackIndexForPort(i_port = %d) - done => %d", i_port, i_returnValue)
    xout i_returnValue
endop


opcode setTrack, 0, iiiSSSS
    i_trackIndex, i_port, i_trackType, S_orcPath, S_instrumentName, SInstanceName, SUuid xin
    log_i_info("opcode setTrack(i_trackIndex = %d, i_port = %d, i_trackType = %d, S_orcPath = %s, SInstanceName = %s, SUuid = %s) ...",
        i_trackIndex, i_port, i_trackType, S_orcPath, SInstanceName, SUuid)
    gi_trackPorts[i_trackIndex] = i_port
    gi_trackTypes[i_trackIndex] = i_trackType
    gS_trackOrcPaths[i_trackIndex] = S_orcPath
    gS_trackInstrumentNames[i_trackIndex] = S_instrumentName
    gSInstanceNames[i_trackIndex] = SInstanceName
    gSTrackUuids[i_trackIndex] = SUuid
    log_i_info("opcode setTrack(i_trackIndex = %d, i_port = %d, i_trackType = %d, S_orcPath = %s, SInstanceName = %s, SUuid = %s) - done",
        i_trackIndex, i_port, i_trackType, S_orcPath, SInstanceName, SUuid)
endop


opcode registerTrack, 0, SSSSSS
    S_port, S_trackType, S_orcPath, S_instrumentName, SInstanceName, SUuid xin
    iInstrumentNumber = nstrnum("RegisterTrack")
igoto end
    scoreline(
        sprintfk("i%d 0 1 %s %s \"%s\" \"%s\" \"%s\" \"%s\"",
            iInstrumentNumber,
            S_port,
            S_trackType,
            S_orcPath,
            S_instrumentName,
            SInstanceName,
            SUuid),
        1)
end:
endop


opcode setPlugin, 0, iiSS
    iTrackIndex, iPluginIndex, SOrcPath, SUuid xin
    log_i_info("opcode setPlugin(i_trackIndex = %d, i_pluginIndex = %d, S_orcPath = %s, SUuid = %s) ...", iTrackIndex,
        iPluginIndex, SOrcPath, SUuid)
    // The given plugin index is 1-based. Change it to 0-based for use in the gSPlugins array.
    iPluginIndex -= 1
    gSPlugins[iTrackIndex][iPluginIndex] = SOrcPath
    gSPluginUuids[iTrackIndex][iPluginIndex] = SUuid
    log_i_info("opcode setPlugin(i_trackIndex = %d, i_pluginIndex = %d, S_orcPath = %s, SUuid = %s) - done",
        iTrackIndex, iPluginIndex, SOrcPath, SUuid)
endop


opcode registerPlugin, 0, SSSS
    STrackIndex, SPluginIndex, SOrcPath, SUuid xin
    iInstrumentNumber = nstrnum("RegisterPlugin")
igoto end
    scoreline(sprintfk("i%d 0 1 %s %s \"%s\" \"%s\"", iInstrumentNumber, STrackIndex, SPluginIndex, SOrcPath,
        SUuid), 1)
end:
endop


opcode addTrackReference, 0, SS
    S_trackIndex, S_trackRefIndex xin
    i_instrumentNumber =  nstrnum("ReferenceTrack")
igoto end
    scoreline(sprintfk("i%d 0 1 %d %d", i_instrumentNumber, strtodk(S_trackIndex), strtodk(S_trackRefIndex)), 1)
end:
endop


opcode clearOrcInstances, 0, 0
    iI = 0
    while (iI < TRACK_COUNT_MAX) do
        gSOrcInstances[iI] = ""
        giOrcInstanceCounts[iI] = 0
        iI += 1
    od
    kI = 0
    while (kI < TRACK_COUNT_MAX) do
        gkOrcInstanceCounters[kI] = 0
        kI += 1
    od
endop


opcode getOrcInstanceIndex, i, S
    SOrcFilename xin
    iI = 0
    while (iI < TRACK_COUNT_MAX && strcmp(gSOrcInstances[iI], "") != 0) do
        if (strcmp(gSOrcInstances[iI], SOrcFilename) == 0) then
            goto end
        endif
        iI += 1
    od
    log_i_debug("Orc index not found for %s after checking %d instances", SOrcFilename, iI)
    iI = -1
end:
    xout iI
endop


opcode getOrcInstanceIndex, k, S
    SOrcFilename xin
    kI = 0
    while (kI < TRACK_COUNT_MAX && strcmpk(gSOrcInstances[kI], "") != 0) do
        if (strcmpk(gSOrcInstances[kI], SOrcFilename) == 0) then
            kgoto end
        endif
        kI += 1
    od
    log_k_debug("Orc index not found for %s after checking %d instances", SOrcFilename, kI)
    kI = -1
end:
    xout kI
endop


opcode getNextOrcInstanceIndex, i, 0
    iI = 0
    while (strcmp(gSOrcInstances[iI], "") != 0) do
        iI += 1
    od
    xout iI
endop


opcode addOrcInstance, 0, S
    SOrcFilename xin
    iIndex = getOrcInstanceIndex(SOrcFilename)
    if (iIndex == -1) then
        iIndex = getNextOrcInstanceIndex()
        gSOrcInstances[iIndex] = SOrcFilename
    endif
    giOrcInstanceCounts[iIndex] = giOrcInstanceCounts[iIndex] + 1
endop


opcode watchOrcFile, 0, SS
    SPort, SOrcPath xin
    iInstrumentNumber = nstrnum("WatchOrcFile")
igoto end
    scoreline(sprintfk("i%d 0 -1 %s \"%s\"", iInstrumentNumber, SPort, SOrcPath), 1)
end:
endop


opcode generateUuid, 0, S
    SPort xin
    iInstrumentNumber = nstrnum("GenerateUuid")
igoto end
    scoreline(sprintfk("i%d 0 -1 %s", iInstrumentNumber, SPort), 1)
end:
endop


opcode set_mode, 0, k
    k_mode xin
    log_k_info("opcode set_mode(k_mode = %d) ...", k_mode)

    k_i = 0
    while (k_i < 4) do
        if (k_mode == k_i + 1) then
            k_on = true
        else
            k_on = false
        endif
        chnset k_on, gS_mode_channels[k_i]
        k_i += 1
    od

    if (gk_mode != k_mode) then
        gk_mode = k_mode
        if (gk_mode == 2) then
            clearTracks()
            clearPlugins()
        endif
        event("i", "WriteMode", 0, 1, gk_mode)
    endif

    log_k_info("opcode set_mode - done")
endop


// Main processing instrument. Always on.
//
instr 1
    ${CSOUND_INCLUDE} "core_instr_1_head.orc"
    log_i_info("instr %d ...", p1)
    log_i_info("instr %d - done", p1)
endin


// Initialize _.mode.txt to 1 if file does not exist.
//
instr InitializeMode
    log_ik_info("%s ...", nstrstr(p1))

    event_i("i", "ReadMode", 0, 1)
    if (gk_mode != 0) then
        log_k_info("%s - done", nstrstr(p1))
        turnoff
    elseif (k(1) < gk_i) then
        if (gk_mode == 0) then
            set_mode(1)
        endif
        log_k_info("%s - done", nstrstr(p1))
        turnoff
    endif
    log_ik_info("%s - done", nstrstr(p1))
endin


// Read float from _.mode.txt.
// Note that _.mode.txt must have a float in it followed by a new line, otherwise Cabbage will crash. If the file does not
// exist, this instrument will error out, so make sure it's only called from the 'event' opcode, otherwise it will
// cause Csound to stop processing the score and exit.
//
instr ReadMode
    log_ik_info("%s ...", nstrstr(p1))
    gk_mode = readk("_.mode.txt", 8, 1)
    set_mode(gk_mode)
    log_k_info("Mode = %d", gk_mode)
    log_ik_info("%s - done", nstrstr(p1))
    turnoff
endin


// Write p4 float to _.mode.txt.
//
instr WriteMode
    log_ik_info("%s ...", nstrstr(p1))
    // Note that opening the file for write with the 'fiopen' opcode clears the file.
    i_fileHandle = fiopen( "_.mode.txt", 0)
    fouti(i_fileHandle, 0, 0, p4)
    ficlose(i_fileHandle)
    log_ik_info("%s - done", nstrstr(p1))
    turnoff
endin


instr HandleModeButtons
    log_i_info("%s ...", nstrstr(p1))
    k_mode init 0
    k_i = 0
    while (k_i < 4) do
        k_on chnget gS_mode_channels[k_i]
        if (k_on == true) then
            k_mode = k_i + 1
        endif
        k_i += 1
    od
    if (changed(k_mode) == true) then
        kPreviousMode = gk_mode
        set_mode(k_mode)
        k_instrument = nstrnum("HandleOscScoreGenerationMessages")
        if (active(k_instrument) == true) then
            event("i", -k_instrument, 0, 0)
        endif
        if (gk_mode == 3 || gk_mode == 4) then
            event("i", k_instrument, 0, -1)
        endif
        if (kPreviousMode == 3 || kPreviousMode == 4) then
            event("i", "WriteTracksetFiles", 0, -1)
        endif
    endif
    log_i_info("%s - done", nstrstr(p1))
endin


instr HandleOscMessages
    // The OSCraw opcode used in this instrument can not be used reliably at the start of the score when Cabbage does an
    // auto-reload from disk. When started with a p2 of zero Csound throws an init error saying ...
    //     InitError in wrong mode 0
    //     INIT ERROR in instr 7 (opcode OSCraw) line 226: bind failed
    //     B  0.000 - note deleted.  i7 (HandleOscMessages) had 1 init errors
    // To work around this issue we restart the instrument 0.1 seconds later instead of at 0 seconds.
    if (p2 < 0.1) then
        event_i("i", p1, 0.1, -1)
        turnoff
    else
        log_i_info("%s ...", nstrstr(p1))
        S_oscMessages[] init 10
        k_oscDataCount = -1
        S_oscPath init ""
        S_oscTypes init ""
        k_j init 0
        while (k_oscDataCount != 0) do
            S_oscMessages, k_oscDataCount OSCraw DAW_SERVICE_OSC_PORT
            if (k(2) <= k_oscDataCount) then
                S_oscPath = S_oscMessages[k(0)]
                k_argCount = k_oscDataCount - 2


                // Track registration
                //
                if (string_begins_with(S_oscPath, DAW_SERVICE_OSC_TRACK_REGISTRATION_PATH) == true) then
                    if (k_argCount < 6) then
                        log_k_error("OSC path '%s' requires 7 arguments but was given %d.",
                            DAW_SERVICE_OSC_TRACK_REGISTRATION_PATH, k_argCount)
                    else
                        // 2 = port
                        // 3 = track type
                        // 4 = orc path
                        // 5 = instrument name
                        // 6 = instance name
                        // 7 = uuid
                        registerTrack(
                            S_oscMessages[k(2)],
                            S_oscMessages[k(3)],
                            S_oscMessages[k(4)],
                            S_oscMessages[k(5)],
                            S_oscMessages[k(6)],
                            S_oscMessages[k(7)])
                    endif
                endif


                // Plugin registration
                //
                if (string_begins_with(S_oscPath, DAW_SERVICE_OSC_PLUGIN_REGISTRATION_PATH) == true) then
                    if (k_argCount < 4) then
                        log_k_error("OSC path '%s' requires 4 arguments but was given %d.",
                            DAW_SERVICE_OSC_PLUGIN_REGISTRATION_PATH, k_argCount)
                    else
                        // 2 = track index
                        // 3 = effect plugin index
                        // 4 = orc path
                        // 5 = uuid
                        registerPlugin(S_oscMessages[k(2)], S_oscMessages[k(3)], S_oscMessages[k(4)],
                            S_oscMessages[k(5)])
                    endif
                endif


                // Message logging
                //
                if (string_begins_with(S_oscPath, DAW_SERVICE_OSC_LOG_MESSAGE_PATH) == true) then
                    if (k_argCount < 1) then
                        log_k_error("OSC path '%s' requires 1 argument but was given %d.",
                            DAW_SERVICE_OSC_LOG_MESSAGE_PATH, k_argCount)
                    else
                        // 2 = message
                        printf("%s  %s\n", gk_i + k_j, time_string_k(), S_oscMessages[k(2)])
                    endif
                endif


                // Plugin .orc change tracking
                //
                if (string_begins_with(S_oscPath, DAW_SERVICE_OSC_PLUGIN_WATCH_ORC_PATH) == true) then
                    if (k_argCount < 2) then
                        log_k_error("OSC path '%s' requires 2 arguments but was given %d.",
                            DAW_SERVICE_OSC_PLUGIN_WATCH_ORC_PATH, k_argCount)
                    else
                        // 2 = port
                        // 3 = .orc file path
                        watchOrcFile(S_oscMessages[k(2)], S_oscMessages[k(3)])
                    endif
                endif


                // Plugin UUID generation
                //
                if (string_begins_with(S_oscPath, DAW_SERVICE_OSC_PLUGIN_REQUEST_UUID_PATH) == true) then
                    if (k_argCount < 1) then
                        log_k_error("OSC path '%s' requires 1 argument but was given %d.",
                            DAW_SERVICE_OSC_PLUGIN_REQUEST_UUID_PATH, k_argCount)
                    else
                        // 2 = port
                        generateUuid(S_oscMessages[k(2)])
                    endif
                endif

            endif
            k_j += 1
        od
        log_i_info("%s - done", nstrstr(p1))
    endif
endin


instr RegisterTrack
    i_oscPort init p4
    i_trackType init p5
    S_orcPath init strget(p6)
    S_instrumentName init strget(p7)
    SInstanceName init strget(p8)
    SUuid init strget(p9)
    log_ik_info(
        "instr RegisterTrack(i_oscPort = %d, i_trackType = %d, S_orcPath = %s, S_instrumentName = %s, SInstanceName = %s, SUuid = %s) ...",
        i_oscPort, i_trackType, S_orcPath, S_instrumentName, SInstanceName, SUuid)
    i_trackIndex = getTrackIndexForPort(i_oscPort)
    if (i_trackIndex == -1) then
        i_trackIndex = getNextTrackIndex()
        setTrack(i_trackIndex, i_oscPort, i_trackType, S_orcPath, S_instrumentName, SInstanceName, SUuid)
    endif
    log_ik_debug("i_trackIndex = %d", i_trackIndex)
    OSCsend(1, TRACK_INFO_OSC_ADDRESS, i_oscPort, sprintfk("%s/%d", TRACK_INFO_OSC_TRACK_SET_INDEX_PATH, i_oscPort),
        "i", i_trackIndex)
    log_ik_info(
        "instr RegisterTrack(i_oscPort = %d, i_trackType = %d, S_orcPath = %s, S_instrumentName = %s, SInstanceName = %s, SUuid = %s) - done",
        i_oscPort, i_trackType, S_orcPath, S_instrumentName, SInstanceName, SUuid)
    turnoff
endin


instr ReferenceTrack
    i_trackIndex = p4
    i_trackRefIndex = p5
    log_i_info("instr ReferenceTrack(i_trackIndex = %d, i_trackRefIndex = %d) ...", i_trackIndex, i_trackRefIndex)
    if (i_trackIndex < 0) then
        log_i_error("Given track index %d is less than zero.", i_trackIndex)
    elseif (i_trackIndex >= TRACK_COUNT_MAX) then
        log_i_error("Given track index %d exceeds track count max %d.", i_trackIndex, TRACK_COUNT_MAX)
    endif
    if (i_trackRefIndex < 0) then
        log_i_error("Given track reference index %d is less than zero.", i_trackRefIndex)
    elseif (i_trackRefIndex >= TRACK_COUNT_MAX) then
        log_i_error("Given track reference index %d exceeds track count max %d.", i_trackRefIndex, TRACK_COUNT_MAX)
    endif    
    gi_trackRefs[i_trackIndex][i_trackRefIndex] = true
    turnoff
endin


instr RegisterPlugin
    i_trackIndex init p4
    i_pluginIndex init p5
    S_orcPath init strget(p6)
    SUuid init strget(p7)

    log_i_trace("instr RegisterPlugin(i_trackIndex = %d, i_pluginIndex = %d, S_orcPath = %s, SUuid = %s) ...",
        i_trackIndex, i_pluginIndex, S_orcPath, SUuid)
    
    setPlugin(i_trackIndex, i_pluginIndex, S_orcPath, SUuid)

    // Log plugins.
    iI = 0
    iTrackCount = getNextTrackIndex()
    log_i_debug("Plugins:")
    while (iI < iTrackCount) do
        iTrackPort = gi_trackPorts[iI]
        iTrackType = gi_trackTypes[iI]
        STrackOrcPath = gS_trackOrcPaths[iI]
        STrackUuid = gSTrackUuids[iI]
        log_i_debug("Track[%d]: port = %d, type = %d, orc = %s, uuid = %s", iI, iTrackPort, iTrackType, STrackOrcPath,
            STrackUuid)
        iJ = 0
        while (iJ < PLUGIN_COUNT_MAX) do
            SOrcFilename = gSPlugins[iI][iJ]
            SPluginUuid = gSPluginUuids[iI][iJ]
            if (strcmp(SOrcFilename, "") != 0) then
                log_i_debug("   Plugin[%d], orc = %s, uuid = %s", iJ, SOrcFilename, SPluginUuid)
                iJ += 1
            else
                // Break out of loop.
                iJ = PLUGIN_COUNT_MAX
            endif
        od
        iI += 1
    od

    log_i_trace("instr RegisterPlugin(i_trackIndex = %d, i_pluginIndex = %d, S_orcPath = %s, SUuid = %s) - done",
        i_trackIndex, i_pluginIndex, S_orcPath, SUuid)
    turnoff
endin


instr WatchOrcFile
    iOscPort init p4
    SOrcPath init strget(p5)

    log_i_trace("instr WatchOrcFile(iOscPort = %d, SOrcPath = %s) ...", iOscPort, SOrcPath)

    log_i_trace("  ... import os ...")
    pylruni("import os")
    log_i_trace("  ... import os - done")
    SPythonCode = sprintf("float(os.path.getmtime(\"%s\"))", SOrcPath)

    kPreviousTime init 0
    kCurrentTime = time_k()
    kPreviousModifiedTime init 0
    kSignal init 1
    if (kCurrentTime - kPreviousTime > 1) then
        kPreviousTime = kCurrentTime
        kModifiedTime = pyleval(SPythonCode)
        if (kPreviousModifiedTime < kModifiedTime) then
            if (kPreviousModifiedTime > 0) then
                log_k_trace("%s changed", SOrcPath)
                OSCsend(kSignal, TRACK_INFO_OSC_ADDRESS, iOscPort,
                    sprintfk("%s/%d", TRACK_INFO_OSC_PLUGIN_ORC_CHANGED_PATH, iOscPort), "i", kSignal)
                kSignal += 1
            endif
            kPreviousModifiedTime = kModifiedTime
        endif
    endif

    log_i_trace("instr WatchOrcFile(iOscPort = %d, SOrcPath = %s) - done", iOscPort, SOrcPath)
endin


instr GenerateUuid
    iOscPort init p4

    log_i_trace("instr GenerateUuid(iOscPort = %d) ...", iOscPort)

    OSCsend(1, TRACK_INFO_OSC_ADDRESS, iOscPort, sprintfk("%s/%d", TRACK_INFO_OSC_PLUGIN_SET_UUID_PATH, iOscPort),
        "s", uuid())

    turnoff
    log_i_trace("instr GenerateUuid(iOscPort = %d) - done", iOscPort)
endin


instr HandleOscScoreGenerationMessages
    log_i_info("%s ...", nstrstr(p1))
    i_mode = i(gk_mode)
    if (i_mode == 3) then
        S_filename = "${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}/_.mode3.sco"
    elseif (i_mode == 4) then
        S_filename = "${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}/_.mode4.sco"

        // This is broken into two lines so Csound doesn't see it as a macro yet.
        fprints(S_filename, "b $")
        fprints(S_filename, "SCORE_START_DELAY\n")
        
        fprints(S_filename, "i \"EndOfInstrumentAllocations\" 0.005 -1\n")
    endif
    S_oscMessages[] init 10
    k_oscDataCount = -1
    S_oscPath init ""
    S_oscTypes init ""
    while (k_oscDataCount != 0) do
        // The OSCraw opcode used in this instrument can not be used reliably at the start of the score when Cabbage
        // does an auto-reload from disk. When started, Csound hangs before outputting any messages.
        // To work around this issue we don't read the OSC messages for the first few k-passes.
        if (gk_i < 10) then
            k_oscDataCount = 0
        else
            S_oscMessages, k_oscDataCount OSCraw DAW_SERVICE_OSC_SCORE_GENERATION_PORT
        endif
        if (k(2) <= k_oscDataCount) then
            S_oscPath = S_oscMessages[k(0)]
            k_argCount = k_oscDataCount - 2


            // Score generation
            //
            if (string_begins_with(S_oscPath, DAW_SERVICE_OSC_SCORE_GENERATION_PATH) == true) then
                if (k_argCount < 1) then
                    log_k_error("OSC path '%s' requires 1 argument but was given %d.",
                        DAW_SERVICE_OSC_SCORE_GENERATION_PATH, k_argCount)
                elseif (k_argCount > 1) then
                    log_k_warning("OSC path '%s' takes 1 argument but was given %d.",
                        DAW_SERVICE_OSC_SCORE_GENERATION_PATH, k_argCount)
                else
                    S_scoreline init ""
                    S_scoreline = S_oscMessages[k(2)]
                    log_k_debug("Writing score line %s", S_scoreline)
                    // NB 'fprintks' requires a literal string in arg 2. Passing a string variable to arg2 results
                    // in garbage file contents, or the same line repeated over and over again.
                    // NB 'fprintks' using only %s in format doesn't work on MacOS. Work around by adding an extra
                    // Unused(%d) pfield set to 0 which will get removed when the playback csd is preprocessed.
                    //     See Github issue https://github.com/csound/csound/issues/1377.
                    fprintks(S_filename, "%s Unused(%d)\n", S_scoreline, 0)
                endif
            endif


            // Track referencing
            //
            if (string_begins_with(S_oscPath, DAW_SERVICE_OSC_TRACK_REFERENCING_PATH) == true) then
                if (k_argCount < 2) then
                    log_k_error("OSC path '%s' requires 2 arguments but was given %d.",
                        DAW_SERVICE_OSC_TRACK_REFERENCING_PATH, k_argCount)
                else
                    S_trackIndex = S_oscMessages[k(2)]
                    S_trackRefIndex = S_oscMessages[k(3)]
                    log_k_debug("Adding track reference. Track index = %s. Track ref index = %s.", S_trackIndex,
                        S_trackRefIndex)
                    addTrackReference(S_trackIndex, S_trackRefIndex)
                endif
            endif
        endif
    od
    log_i_info("%s - done", nstrstr(p1))
endin


instr WriteTracksetFiles
    log_i_info("%s ...", nstrstr(p1))

    // Clear trackset order and count.
    iI = 0
    while (iI < TRACK_COUNT_MAX) do
        giTracksetOrder[iI] = -1
        iI += 1
    od
    giTracksetCount = 0

    iTrackCount = getNextTrackIndex()
    if (iTrackCount <= 0) goto end

    // Flags for tracks already added to trackset.
    iTracksAddedToTrackset[] init iTrackCount
    iI = 0
    while (iI < iTrackCount) do
        iTracksAddedToTrackset[iI] = false
        iI += 1
    od

    // Add audio and instrument tracks to trackset.
    iI = 0
    while (iI < iTrackCount) do
        if (gi_trackTypes[iI] == TRACK_TYPE_AUDIO || gi_trackTypes[iI] == TRACK_TYPE_INSTRUMENT) then
            log_i_debug("Adding track to giTracksetOrder[%d] = %d (Track port = %d, type = %d, orc = %s)",
                giTracksetCount, iI, gi_trackPorts[iI], gi_trackTypes[iI], gS_trackOrcPaths[iI])
            giTracksetOrder[giTracksetCount] = iI
            giTracksetCount += 1
            iTracksAddedToTrackset[iI] = true
        endif
        iI += 1
    od

    // Add aux tracks to trackset.
    iDone = false
    while (iDone == false) do
        iI = 0
        // Hope for done. Set to false later if not.
        iDone = true
        while (iI < iTrackCount) do
            if (iTracksAddedToTrackset[iI] == false) then
                // Flag aux track if it has track refs that haven't been added to trackset yet. 
                iHasPendingRef = false
                iJ = 0
                while (iJ < iTrackCount && iHasPendingRef == false) do
                    if (gi_trackRefs[iI][iJ] == true && iTracksAddedToTrackset[iJ] == false) then
                        iHasPendingRef = true
                    else
                        iJ += 1
                    endif
                od

                // Add the aux track to the trackset if all of its track refs have already been added to the trackset.
                if (iHasPendingRef == false) then
                    log_i_debug("Adding track to giTracksetOrder[%d] = %d (Track port = %d, type = %d, orc = %s)",
                        giTracksetCount, iI, gi_trackPorts[iI], gi_trackTypes[iI], gS_trackOrcPaths[iI])
                    giTracksetOrder[giTracksetCount] = iI
                    giTracksetCount += 1
                    iTracksAddedToTrackset[iI] = true
                else
                    // Aux track can't be added because it has track refs that haven't been added yet. Set iDone to
                    // false so outer loop runs again.
                    iDone = false
                endif
            endif
            iI += 1
        od
    od

#if LOG_DEBUG
    // Log tracks.
    log_k_debug("Tracks:")
    iTrackCount = getNextTrackIndex()
    kI = 0
    while (kI < iTrackCount) do
        kTrackPort = gi_trackPorts[kI]
        kTrackType = gi_trackTypes[kI]
        STrackOrcPath = gS_trackOrcPaths[kI]
        STrackUuid = gSTrackUuids[kI]
        log_k_debug("[%d]: Track port = %d, type = %d, orc = %s, uuid = %s", kI, kTrackPort, kTrackType, STrackOrcPath,
            STrackUuid)
        kI += 1
    od

    // Log tracksets.
    log_k_debug("Trackset:")
    kI = 0
    while (kI < giTracksetCount) do
        kTrackIndex = giTracksetOrder[kI]
        log_k_debug("[%d]: Track index = %d, type = %d, orc = %s, uuid = %s", kI, kTrackIndex, gi_trackTypes[kTrackIndex],
            gS_trackOrcPaths[kTrackIndex], gSTrackUuids[kTrackIndex])
        kI += 1 
    od

    // Log track references.
    log_k_debug("Track references:")
    kI = 0
    while (kI < iTrackCount) do
        log_k_debug("[%d]: orc = %s", kI, gS_trackOrcPaths[kI])
        kJ = 0
        while (kJ < iTrackCount) do
            log_k_debug("   [%d]: %d", kJ, gi_trackRefs[kI][kJ])
            kJ += 1
        od
        kI += 1
    od

    // Log plugins.
    log_k_debug("Plugins:")
    kI = 0
    while (kI < iTrackCount) do
        kTrackPort = gi_trackPorts[kI]
        kTrackType = gi_trackTypes[kI]
        STrackOrcPath = gS_trackOrcPaths[kI]
        log_k_debug("Track[%d]: Track port = %d, type = %d, orc = %s", kI, kTrackPort, kTrackType, STrackOrcPath)
        kJ = 0
        while (kJ < PLUGIN_COUNT_MAX) do
            SOrcFilename = gSPlugins[kI][kJ]
            if (strcmpk(SOrcFilename, "") != 0) then
                log_k_debug("   Plugin[%d], SOrcFilename = %s", kJ, SOrcFilename)
                kJ += 1
            else
                // Break out of loop.
                kJ = PLUGIN_COUNT_MAX
            endif
        od
        kI += 1
    od
#endif

    // Write the files based on the trackset order.
    event_i("i", "WriteTrackDefinesFile", 0, -1)
    event_i("i", "WriteTracksetOrcFile", 0, -1)
    event_i("i", "WriteTracksetScoFile", 0, -1)

end:
    turnoff

    log_i_info("%s - done", nstrstr(p1))
endin


instr WriteTrackDefinesFile
    log_i_info("%s ...", nstrstr(p1))
    
    S_filename = "${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}/_.mode3_TrackDefines.h"
    kI = 0
    kPreviousTrackType = TRACK_TYPE_NONE
    kInstrumentNumber = 0
    while (kI < giTracksetCount) do
        kTrack = giTracksetOrder[kI]
        kI += 1

        // Write track instrument number defines.
        S_orcFilename = gS_trackOrcPaths[kTrack]
        k_trackType = gi_trackTypes[kTrack]
        if (k_trackType == TRACK_TYPE_AUDIO || k_trackType == TRACK_TYPE_INSTRUMENT) then
            SInstrumentName = sprintfk("%s_%d", strsubk(S_orcFilename, 0, strrindexk(S_orcFilename, ".orc")), kTrack)
        elseif (kPreviousTrackType == TRACK_TYPE_AUDIO || kPreviousTrackType == TRACK_TYPE_INSTRUMENT) then
            SInstrumentName = sprintfk("%s", "AuxMixInstrument")
            k_trackType = TRACK_TYPE_NONE
            kI -= 1
        elseif (k_trackType == TRACK_TYPE_BUS) then
            SInstrumentName = sprintfk("%s", "AuxInstrument")
        elseif (k_trackType == TRACK_TYPE_MASTER) then
            SInstrumentName = sprintfk("%s", "MasterInstrument")
        else
            log_k_warning("Unknown track type %d.", k_trackType)
        endif
        kPreviousTrackType = k_trackType
        fprintks(S_filename, "#define %s %d\n", SInstrumentName, TRACK_PLAYBACK_INSTRUMENT_START_INDEX +
            kInstrumentNumber)
        kInstrumentNumber += 1

        // Don't write track's plugins if the AuxMixInstrument was inserted (track type was set to none for this case).
        if (k_trackType != TRACK_TYPE_NONE) then
            // Write plugin instrument number defines.
            kJ = 0
            while (kJ < PLUGIN_COUNT_MAX) do
                SOrcFilename = gSPlugins[kTrack][kJ]
                if (strcmpk(SOrcFilename, "") != 0) then
                    SInstrumentName = sprintfk("%s_%d_%d", strsubk(SOrcFilename, 0, strrindexk(SOrcFilename, ".orc")),
                        kTrack, kJ)
                    fprintks(S_filename, "#define %s %d\n", SInstrumentName, TRACK_PLAYBACK_INSTRUMENT_START_INDEX +
                        kInstrumentNumber)
                    kInstrumentNumber += 1
                    kJ += 1
                else
                    // Break out of loop.
                    kJ = PLUGIN_COUNT_MAX
                endif
            od
        endif
    od

    // Write final mix instrument number define.
    fprintks(S_filename, "#define FinalMixInstrument %d\n", TRACK_PLAYBACK_INSTRUMENT_START_INDEX + kInstrumentNumber)

    turnoff
    
    log_i_info("%s - done", nstrstr(p1))
endin


instr WriteTracksetOrcFile
    log_i_info("%s ...", nstrstr(p1))

    S_filename = "${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}/_.mode3_TrackSet.orc"

    clearOrcInstances()
    iI = 0
    iTrackCount = getNextTrackIndex()
    while (iI < iTrackCount) do
        addOrcInstance(gS_trackOrcPaths[iI])
        iJ = 0
        while (iJ < PLUGIN_COUNT_MAX) do
            SPluginOrcFilename = gSPlugins[iI][iJ]
            if (strcmp(SPluginOrcFilename, "") != 0) then
                addOrcInstance(SPluginOrcFilename)
            endif
            iJ += 1
        od
        iI += 1
    od

#if LOG_DEBUG
    iI = 0
    iBreak = false
    while (iBreak == false) do
        SOrcFilename = gSOrcInstances[iI]
        if (strcmp(SOrcFilename, "") != 0) then
            log_i_debug("gSOrcInstances[%d]: Orc = %s, Count = %d", iI, SOrcFilename, giOrcInstanceCounts[iI])
            iI += 1
        else
            iBreak = true
        endif
    od
#endif

    k_tracksWritten = 0
    kI = 0
    while (kI < giTracksetCount) do
        kTrack = giTracksetOrder[kI]
        k_trackType = gi_trackTypes[kTrack]
        if (k_trackType == TRACK_TYPE_AUDIO || k_trackType == TRACK_TYPE_INSTRUMENT) then

            S_orcFilename = gS_trackOrcPaths[kTrack]
            S_instrumentName = gS_trackInstrumentNames[kTrack]
            SInstanceName = gSInstanceNames[kTrack]
            STrackUuid = gSTrackUuids[kTrack]
            kOrcInstanceIndex = getOrcInstanceIndex:k(S_orcFilename)
            log_k_debug("Trackset %d: kOrcInstanceIndex = %d", kI, kOrcInstanceIndex)
            kOrcInstance = gkOrcInstanceCounters[kOrcInstanceIndex]
            gkOrcInstanceCounters[kOrcInstanceIndex] = kOrcInstance + 1
            ; if (k_trackType == TRACK_TYPE_INSTRUMENT) then
                SOrcDirectory = "Synths"
            ; else
            ;     SOrcDirectory = "Effects"
            ; endif
            SOrcSubDirectory = strsubk(S_orcFilename, 0, strlenk(S_orcFilename) - 4)
            SInstrumentId = sprintfk("%s_%d", strsubk(S_orcFilename, 0, strrindexk(S_orcFilename, ".orc")), kTrack)

            fprintks(S_filename, "#define INSTRUMENT_ID %s // -%d\n", SInstrumentId, 0)
            fprintks(S_filename, "#define INSTRUMENT_NAME %s // -%d\n", S_instrumentName, 0)
            fprintks(S_filename, "#define INSTANCE_NAME STRINGIZE(%s) // -%d\n", SInstanceName, 0)
            fprintks(S_filename, "#define INSTRUMENT_TRACK_INDEX %d\n", kI)
            fprintks(S_filename, "#define INSTRUMENT_PLUGIN_INDEX 0\n")
            fprintks(S_filename, "#define INSTRUMENT_PLUGIN_UUID \"%s\" // -%d\n", STrackUuid, 0)
            fprintks(S_filename, "#define ORC_INSTANCE_COUNT %d\n", giOrcInstanceCounts[kOrcInstanceIndex])
            fprintks(S_filename, "#define ORC_INSTANCE_INDEX %d\n", kOrcInstance)
            fprintks(S_filename, "#include \"${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}/%s/%s/%s\" // -%d\n", \
                SOrcDirectory, SOrcSubDirectory, S_orcFilename, 0)
            fprintks(S_filename, "#undef ORC_INSTANCE_INDEX\n")
            fprintks(S_filename, "#undef ORC_INSTANCE_COUNT\n")
            fprintks(S_filename, "#undef INSTRUMENT_PLUGIN_UUID\n")
            fprintks(S_filename, "#undef INSTRUMENT_PLUGIN_INDEX\n")
            fprintks(S_filename, "#undef INSTRUMENT_TRACK_INDEX\n")
            fprintks(S_filename, "#undef INSTANCE_NAME\n")
            fprintks(S_filename, "#undef INSTRUMENT_NAME\n")
            fprintks(S_filename, "#undef INSTRUMENT_ID\n")
            fprintks(S_filename, "\n")
        endif

        kJ = 0
        while (kJ < PLUGIN_COUNT_MAX) do
            SOrcFilename = gSPlugins[kTrack][kJ]
            if (strcmpk(SOrcFilename, "") != 0) then
                kOrcInstanceIndex = getOrcInstanceIndex:k(SOrcFilename)
                log_k_debug("   Plugin %d: kOrcInstanceIndex = %d", kJ, kOrcInstanceIndex)
                STrackUuid = gSPluginUuids[kTrack][kJ]
                kOrcInstance = gkOrcInstanceCounters[kOrcInstanceIndex]
                gkOrcInstanceCounters[kOrcInstanceIndex] = kOrcInstance + 1
                log_k_debug("kTrackIndex = %d, kPluginIndex = %d, SOrcFilename = %s", kI, kJ, SOrcFilename)
                SInstrumentId = sprintfk("%s_%d_%d", strsubk(SOrcFilename, 0, strrindexk(SOrcFilename, ".orc")),
                    kTrack, kJ)
                SOrcSubDirectory = strsubk(SOrcFilename, 0, strlenk(SOrcFilename) - 4)

                fprintks(S_filename, "#define INSTRUMENT_ID %s // -%d\n", SInstrumentId, 0)
                fprintks(S_filename, "#define INSTRUMENT_TRACK_INDEX %d\n", kI)
                fprintks(S_filename, "#define INSTRUMENT_PLUGIN_INDEX %d\n", kJ + 1)
                fprintks(S_filename, "#define ORC_INSTANCE_COUNT %d\n", giOrcInstanceCounts[kOrcInstanceIndex])
                fprintks(S_filename, "#define ORC_INSTANCE_INDEX %d\n", kOrcInstance)
                fprintks(S_filename, "#include \"${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}/Effects/%s/%s\" // -%d\n",
                    SOrcSubDirectory, SOrcFilename, 0)
                fprintks(S_filename, "#undef ORC_INSTANCE_INDEX\n")
                fprintks(S_filename, "#undef ORC_INSTANCE_COUNT\n")
                fprintks(S_filename, "#undef INSTRUMENT_PLUGIN_INDEX\n")
                fprintks(S_filename, "#undef INSTRUMENT_TRACK_INDEX\n")
                fprintks(S_filename, "#undef INSTRUMENT_NAME\n")
                fprintks(S_filename, "#undef INSTRUMENT_ID\n")
                fprintks(S_filename, "\n")

                kJ += 1
            else
                // Break out of loop.
                kJ = PLUGIN_COUNT_MAX
            endif
        od

        kI += 1
    od
    turnoff
    
    log_i_info("%s - done", nstrstr(p1))
endin


instr WriteTracksetScoFile
    log_i_info("%s ...", nstrstr(p1))

    S_filename = "${CSOUND_CMAKE_BUILD_INLINED_CONFIGURED_DIR}/_.mode3_TrackSet.sco"
    kI = 0
    kInstrumentCount = 0
    kAuxCount = 0
    while (kI < giTracksetCount) do
        kTrack = giTracksetOrder[kI]
        kTrackType = gi_trackTypes[kTrack]
        if (TRACK_TYPE_INSTRUMENT == kTrackType) then
            kInstrumentCount += 1
        elseif (TRACK_TYPE_BUS == kTrackType) then
            kAuxCount += 1
        endif
        kI += 1
    od
    iTrackCount = getNextTrackIndex()
    kI = 0
    kInstrumentIndexOffset = 0
    while (kI < iTrackCount) do
        k_trackType = gi_trackTypes[kI]
        if (k_trackType == TRACK_TYPE_AUDIO || k_trackType == TRACK_TYPE_INSTRUMENT) then
            kInstrumentIndexOffset = kI
            // Exit while loop.
            kI = iTrackCount
        else
            kI += 1
        endif
    od
    kI = 0
    kAuxIndexOffset = 0
    while (kI < iTrackCount) do
        k_trackType = gi_trackTypes[kI]
        if (k_trackType == TRACK_TYPE_BUS) then
            kAuxIndexOffset = kI
            // Exit while loop.
            kI = iTrackCount
        else
            kI += 1
        endif
    od
    fprintks(S_filename,
        "i Init_instrnum 0 -1 InstrumentCount(%d) InstrumentIndexOffset(%d) AuxCount(%d) AuxIndexOffset(%d)\n", \
        kInstrumentCount, kInstrumentIndexOffset, kAuxCount, kAuxIndexOffset)

    kI = 0
    while (kI < iTrackCount) do
        kJ = 0
        while (kJ < PLUGIN_COUNT_MAX) do
            SOrcFilename = gSPlugins[kI][kJ]
            if (strcmpk(SOrcFilename, "") != 0) then
                SInstrumentName = sprintfk("%s_%d_%d", strsubk(SOrcFilename, 0, strrindexk(SOrcFilename, ".orc")),
                    kI, kJ)
                // NB: A fractional instrument is used here so it doesn't get turned off by the non-fractional CC event
                // score lines.
                fprintks(S_filename, "i CONCAT(%s, .1) 0 -1 EVENT_EFFECT_ON Unused(%d)\n", SInstrumentName, 0)
                kJ += 1
            else
                // Break out of loop.
                kJ = PLUGIN_COUNT_MAX
            endif
        od
        kI += 1
    od

    turnoff
    log_i_info("%s - done", nstrstr(p1))
endin


</CsInstruments>
<CsScore>

i1 0 z
i"HandleModeButtons" 0 z
i"HandleOscMessages" 0 z
i"InitializeMode" 0 z

</CsScore>
</CsoundSynthesizer>
<Cabbage>

${form} caption("DAW Service") size(${form_size}) pluginid("0000")
${mode_button} bounds(${button1_xy}, ${button_size}) text("Mode 1") channel("mode-1") colour:1(${dark_green})
${mode_button} bounds(${button2_xy}, ${button_size}) text("Mode 2") channel("mode-2") colour:1(${red})
${mode_button} bounds(${button3_xy}, ${button_size}) text("Mode 3") channel("mode-3") colour:1(${red})
${mode_button} bounds(${button4_xy}, ${button_size}) text("Mode 4") channel("mode-4") colour:1(${red})

</Cabbage>
