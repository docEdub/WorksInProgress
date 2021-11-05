#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: uuid.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_uuid_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_uuid_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_INCLUDE} "log.orc"


opcode uuid, S, 0
    iResult = system_i(true, "python -c 'import sys,uuid; sys.stdout.write(uuid.uuid4().hex)' > uuid.txt")
    iJ = 0
    iFileHandle = fiopen("uuid.txt", 1)
    SUuid, iJ readfi iFileHandle
    ficlose iFileHandle
    xout SUuid
endop


${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
