#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_json_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_json_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

//----------------------------------------------------------------------------------------------------------------------
// File: json.orc
//----------------------------------------------------------------------------------------------------------------------

#define JSON_START "{\"csound\":{"
#define JSON_END "}}"

opcode json_start_i, 0, 0
    prints(JSON_START)
endop

opcode json_start_k, 0, 0
    printsk(JSON_START)
endop

opcode json_end_i, 0, 0
    prints(JSON_END)
endop

opcode json_end_k, 0, 0
    printsk(JSON_END)
endop

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
