#include "definitions.h"

${CSOUND_INCLUDE} "log.orc"


gkReloaded init false


instr CompileOrc
    if (gkReloaded == true) then
        gkReloaded = false
        turnoff
    endif

    log_i_info("Compiling ${InstrumentName}.orc ...")
    iResult = compileorc("${CSD_PREPROCESSED_FILES_DIR}/${InstrumentName}.orc")
    if (iResult == 0) then
        log_i_info("Compiling ${InstrumentName}.orc - succeeded")
        gkReloaded = true
    else
        log_i_info("Compiling ${InstrumentName}.orc - failed")
        log_i_info("Compiling ${InstrumentName}.orc - retrying ...")
        event_i("i", "CompileOrc", 0, -1)
    endif

endin


instr ListenForChangedOrcFile
    log_i_trace("instr ListenForChangedOrcFile(port = %d) ...", gi_oscPort)

    kSignal init -1
    kReceived = OSClisten(gi_oscHandle, sprintfk("%s/%d", TRACK_INFO_OSC_PLUGIN_ORC_CHANGED_PATH, gi_oscPort), "i",
        kSignal)
    if (kReceived == true) then
        log_k_debug("${InstrumentName}.orc changed. Port = %d", gi_oscPort)
        event("i", "CompileOrc", 0, -1)
    endif

    ; #if LOGGING
    ;     kTime = time_k()
    ;     kLastPrintTime init 0
    ;     if (kTime - kLastPrintTime > 1) then
    ;         log_k_trace("Listening ...")
    ;         kLastPrintTime = kTime
    ;     endif
    ; #endif

    log_i_trace("instr ListenForChangedOrcFile(port = %d) - done", gi_oscPort)
endin


instr WatchOrcFile
    log_i_trace("instr WatchOrcFile ...")
    if (gi_oscHandle == -1) then
        log_k_trace("Request not sent. (gi_oscHandle == -1).")
        event("i", "InitializeOSC", 0, -1)
        event("i", p1, 1, -1)
    else
        OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_PLUGIN_WATCH_ORC_PATH, "is",
            gi_oscPort, "${CSD_PREPROCESSED_FILES_DIR}/${InstrumentName}.orc")
        event("i", "ListenForChangedOrcFile", 0, -1)
    endif
    turnoff
    log_i_trace("instr WatchOrcFile - done")
endin

event_i("i", "WatchOrcFile", 1, -1)
