#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: uuid.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_uuid_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_uuid_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_INCLUDE} "log.orc"


gSUuid init ""

instr UpdateUuid
    kResult = system(true, "python -c 'import sys,uuid; sys.stdout.write(uuid.uuid4().hex)' > ${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}/uuid.txt")
    kJ init 0
    gSUuid, kJ readf "${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}/uuid.txt"
    log_k_debug("gSUuid = %s", gSUuid)
    turnoff
endin

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
