#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: json_opcodes.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_json_opcodes_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_json_opcodes_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

opcode json_write_object_start, 0, SO
    SFilename, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "{")
endop

opcode json_write_object_end, 0, S
    SFilename xin
    fprintks(SFilename, "}")
endop

opcode json_write_array_start, 0, SO
    SFilename, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "[")
endop

opcode json_write_array_end, 0, S
    SFilename xin
    fprintks(SFilename, "]")
endop

opcode json_write_key, 0, SSO
    SFilename, SKey, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "\"%s\":", SKey)
endop

opcode json_write_string, 0, SSO
    SFilename, SString, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "\"%s\"", SString)
endop

opcode json_write_integer, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%d", kInteger)
endop

opcode json_write_decimal, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%f", kNumber)
endop

opcode json_write_decimal_1, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.1f", kNumber)
endop

opcode json_write_decimal_2, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.2f", kNumber)
endop

opcode json_write_decimal_3, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.3f", kNumber)
endop

opcode json_write_decimal_3, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.3f", kNumber)
endop

opcode json_write_decimal_4, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.4f", kNumber)
endop

opcode json_write_decimal_5, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.5f", kNumber)
endop

opcode json_write_decimal_6, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.6f", kNumber)
endop

opcode json_write_bool, 0, SkO
    SFilename, kBool, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    if (kBool == true) then
        fprintks(SFilename, "true")
    else
        fprintks(SFilename, "false")
    endif
endop

opcode json_write_null, 0, S0
    SFilename, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "null")
endop

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
