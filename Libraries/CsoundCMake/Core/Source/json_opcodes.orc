#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: json_opcodes.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_json_opcodes_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_json_opcodes_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_IFDEF} IS_GENERATING_JSON

//----------------------------------------------------------------------------------------------------------------------
// i-time opcodes

opcode json_write_object_start_i, 0, So
    SFilename, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "{")
endop

opcode json_write_object_end_i, 0, S
    SFilename xin
    fprints(SFilename, "}")
endop

opcode json_write_array_start_i, 0, So
    SFilename, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "[")
endop

opcode json_write_array_end_i, 0, S
    SFilename xin
    fprints(SFilename, "]")
endop

opcode json_write_key_i, 0, SSo
    SFilename, SKey, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "\"%s\":", SKey)
endop

opcode json_write_string_i, 0, SSo
    SFilename, SString, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "\"%s\"", SString)
endop

opcode json_write_integer_i, 0, Sio
    SFilename, iNumber, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "%d", iNumber)
endop

opcode json_write_decimal_i, 0, Sio
    SFilename, iNumber, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "%f", iNumber)
endop

opcode json_write_decimal_1_i, 0, Sio
    SFilename, iNumber, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "%.1f", iNumber)
endop

opcode json_write_decimal_2_i, 0, Sio
    SFilename, iNumber, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "%.2f", iNumber)
endop

opcode json_write_decimal_3_i, 0, Sio
    SFilename, iNumber, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "%.3f", iNumber)
endop

opcode json_write_decimal_4_i, 0, Sio
    SFilename, iNumber, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "%.4f", iNumber)
endop

opcode json_write_decimal_5_i, 0, Sio
    SFilename, iNumber, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "%.5f", iNumber)
endop

opcode json_write_decimal_6_i, 0, Sio
    SFilename, iNumber, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "%.6f", iNumber)
endop

opcode json_write_bool_i, 0, Sio
    SFilename, iBool, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    if (iBool == true) then
        fprints(SFilename, "true")
    else
        fprints(SFilename, "false")
    endif
endop

opcode json_write_null_i, 0, So
    SFilename, iAddComma xin
    if (iAddComma == true) then
        fprints(SFilename, ",")
    endif
    fprints(SFilename, "null")
endop

//----------------------------------------------------------------------------------------------------------------------
// k-rate opcodes

opcode json_write_object_start_k, 0, SO
    SFilename, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "{")
endop

opcode json_write_object_end_k, 0, S
    SFilename xin
    fprintks(SFilename, "}")
endop

opcode json_write_array_start_k, 0, SO
    SFilename, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "[")
endop

opcode json_write_array_end_k, 0, S
    SFilename xin
    fprintks(SFilename, "]")
endop

opcode json_write_key_k, 0, SSO
    SFilename, SKey, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "\"%s\":", SKey)
endop

opcode json_write_string_k, 0, SSO
    SFilename, SString, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "\"%s\"", SString)
endop

opcode json_write_integer_k, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%d", kNumber)
endop

opcode json_write_decimal_k, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%f", kNumber)
endop

opcode json_write_decimal_1_k, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.1f", kNumber)
endop

opcode json_write_decimal_2_k, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.2f", kNumber)
endop

opcode json_write_decimal_3_k, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.3f", kNumber)
endop

opcode json_write_decimal_4_k, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.4f", kNumber)
endop

opcode json_write_decimal_5_k, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.5f", kNumber)
endop

opcode json_write_decimal_6_k, 0, SkO
    SFilename, kNumber, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "%.6f", kNumber)
endop

opcode json_write_bool_k, 0, SkO
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

opcode json_write_null_k, 0, SO
    SFilename, kAddComma xin
    if (kAddComma == true) then
        fprintks(SFilename, ",")
    endif
    fprintks(SFilename, "null")
endop

${CSOUND_ENDIF} // IS_GENERATING_JSON

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
