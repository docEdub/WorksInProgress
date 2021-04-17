#include <definitions.h>

<CsoundSynthesizer>
<CsOptions>

; ----------------------------------------------------------------------------------------------------------------------
; Benchmarks:
; ----------------------------------------------------------------------------------------------------------------------
; 2021-04-17-1348  real: 9.626s, CPU: 9.626s - real: 9.817s, CPU: 9.814s
; 2021-04-17-1635  real: 9.589s, CPU: 9.589s - real: 9.712s, CPU: 9.712s
; ----------------------------------------------------------------------------------------------------------------------

#include "csd_options.h"

</CsOptions>
<CsInstruments>

#define OUT_CHANNEL_COUNT 6

#include "core_global.h"

${CSOUND_DEFINE} CSD_FILE_PATH #__FILE__#
${CSOUND_INCLUDE} "core_global.orc"

gkReloaded init false

instr 1
    ${CSOUND_INCLUDE} "core_instr_1_head.orc"
endin

#define INSTRUMENT_ID 2
#include "${InstrumentName}.orc"

</CsInstruments>
<CsScore>

i1 0 -1
i 2 0 1000 EVENT_NOTE_ON 60 90
e

</CsScore>
</CsoundSynthesizer>
<Cabbage>
</Cabbage>
