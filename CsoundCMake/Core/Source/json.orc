#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_json_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_json_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

//----------------------------------------------------------------------------------------------------------------------
// File: json.orc
//----------------------------------------------------------------------------------------------------------------------

#define JSON_START "{\"csJSON\":"
#define JSON_END "}\n"

opcode jsonPrint_i, 0, S
    SText xin
    prints(SText)
endop

opcode jsonPrint_k, 0, S
    SText xin
    printsk(SText)
endop

opcode jsonStart_i, 0, S
    SUuid xin
    prints(JSON_START)
    prints("{\"%s\":{", SUuid)
endop

opcode jsonStart_k, 0, S
    SUuid xin
    printsk(JSON_START)
    printsk("{\"%s\":{", SUuid)
endop

opcode jsonEnd_i, 0, 0
    prints("}}") // uuid
    prints(JSON_END)
endop

opcode jsonEnd_k, 0, 0
    printsk("}}") // uuid
    printsk(JSON_END)
endop

opcode jsonKey_i, 0, S
    SKey xin
    prints("\"%s\":", SKey)
endop

opcode jsonKey_k, 0, S
    SKey xin
    printsk("\"%s\":", SKey)
endop

opcode jsonBool_i, 0, Si
    SKey, iValue xin
    jsonKey_i(SKey)
    if (iValue == false) then
        prints("false")
    else
        prints("true")
    endif
endop

opcode jsonBool_k, 0, Sk
    SKey, kValue xin
    jsonKey_k(SKey)
    if (kValue == false) then
        printsk("false")
    else
        printsk("true")
    endif
endop

opcode jsonInteger_i, 0, Si
    SKey, iValue xin
    jsonKey_i(SKey)
    prints("%d", iValue)
endop

opcode jsonInteger_i, 0, Sk
    SKey, kValue xin
    jsonKey_k(SKey)
    prints("%d", kValue)
endop

opcode jsonFloat_i, 0, Si
    SKey, iValue xin
    jsonKey_i(SKey)
    prints("%.3f", iValue)
endop

opcode jsonFloat_k, 0, Sk
    SKey, kValue xin
    jsonKey_k(SKey)
    printsk("%.3f", kValue)
endop

opcode jsonString_i, 0, SS
    SKey, SValue xin
    jsonKey_i(SKey)
    prints("\"%s\"", SValue)
endop

opcode jsonString_k, 0, SS
    SKey, SValue xin
    jsonKey_k(SKey)
    printsk("\"%s\"", SValue)
endop

opcode jsonNull_i, 0, S
    SKey xin
    jsonKey_i(SKey)
    prints("null")
endop

opcode jsonNull_k, 0, S
    SKey xin
    jsonKey_k(SKey)
    printsk(":null")
endop

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
