#include <definitions.h>

<CsoundSynthesizer>
<CsOptions>

--env:INCDIR=${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}
--nodisplays
--nosound
-+rtmidi=null

</CsOptions>
<CsInstruments>

sr = 48000
kr = 480
0dbfs = 1

instr 1
    printsk("Sending signal ...\n")
    OSCsend(k(0), DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_PORT, DAW_SERVICE_OSC_PLUGIN_UPDATE_WATCHED_ORCS_PATH, "i", k(0))
    printsk("Sending signal - done\n")
    turnoff
endin

</CsInstruments>
<CsScore>

i1 0 1

</CsScore>
</CsoundSynthesizer>
