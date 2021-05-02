#include "definitions.h"

<CsoundSynthesizer>
<CsOptions>

--env:INCDIR=${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}
--midi-device=0
--nodisplays
--nosound
-+rtmidi=null

</CsOptions>
<CsInstruments>

#include "core_global.h"

#define DISABLE_LOGGING_TO_DAW_SERVICE

${CSOUND_DEFINE} CSD_FILE_PATH #__FILE__#
${CSOUND_DEFINE} INSTANCE_NAME #"Testing"#
${CSOUND_INCLUDE} "core_global.orc"
${CSOUND_INCLUDE} "log.orc"

gSPluginUuids[] fillarray \
    "069e83fd-1c94-47e9-95ec-126e0fbefec3", \
    "b4f7a35c-6198-422f-be6e-fa126f31b007", \
    "baeea327-af4b-4b10-a843-6614c20ea958", \
    "blah"

giWriteComma init false

instr Quit
    exitnow
endin

instr StartJsonArray
    turnoff
    fprints("test.json", "[")
endin

instr EndJsonArray
    turnoff
    fprints("test.json", "]")
endin

instr ProcessFolder
    turnoff
    SFolder = strget(p4)
    SFilePath = sprintf("/Users/andy/-/code/WorksInProgress/Projects/ProofOfConcept/Csound/Testing/%s/exists.json",
        SFolder)

    iWroteComma = false

    iI = 0
    while (iI != -1) do
        // Csound will kill this instrument if the given file doesn't exist.
        SLine, iI readfi SFilePath

        // A comma isn't needed if the file doesn't exist so we wait to write the comma after Csound is given a chance
        // to kill this instrument.
        if (iWroteComma == false) then
            if (giWriteComma == true) then
                fprints("test.json", ",")
            else
                giWriteComma = true
            endif
            iWroteComma = true
        endif

        if (iI == -1) then
            log_i_debug("%s - done", SFolder)
        else
            // Remove trailing newline.
            if (strcmp(strsub(SLine, strlen(SLine) - 1, strlen(SLine)), "\n") == 0) then
                SLine = strsub(SLine, 0, strlen(SLine) - 1)
            endif
            fprints("test.json", SLine)
            log_i_debug("%s(%d): %s", SFolder, iI, SLine)
        endif
    od
endin

instr ProcessFolders
    turnoff
    log_i_trace("instr ProcessFolders ...")
    iI = 0
    scoreline_i("i \"StartJsonArray\" 0 0")
    while (iI < lenarray(gSPluginUuids)) do
        scoreline_i(sprintf("i \"ProcessFolder\" 0 0 \"%s\"", gSPluginUuids[iI]))
        iI += 1
    od
    scoreline_i("i \"EndJsonArray\" 0 0")
    scoreline_i("i \"Quit\" 0 0")
    log_i_trace("instr ProcessFolders - done")
endin

</CsInstruments>
<CsScore>

i"ProcessFolders" 0 z

</CsScore>
</CsoundSynthesizer>
