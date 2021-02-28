#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: string.orc
//
// N.B. The opcodes in log.orc are not available in this file because log.orc includes it.
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_string_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_string_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

#define ASCII_CODE__BACKSLASH 92
#define ASCII_CODE__SLASH 47

opcode string_begins_with, k, SS
    S_string, S_string_beginning xin
    S_substring = strsubk(S_string, 0, strlenk(S_string_beginning))
    k_result = false
    if (strcmpk(strsubk(S_string, 0, strlenk(S_string_beginning)), S_string_beginning) == 0) then
        k_result = true
    endif
    xout k_result
endop

opcode filename_from_full_path_i, S, S
    S_fullPath xin
    i_fullPathLength = strlen(S_fullPath)
    ii = i_fullPathLength - 1
    i_found = false
    while (i_found == false && 0 < ii) do
        i_char = strchar(S_fullPath, ii)
        if (i_char == ASCII_CODE__SLASH || i_char == ASCII_CODE__BACKSLASH) then
            i_found = true
        else
            ii -= 1
        endif
    od
    S_filename = strsub(S_fullPath, ii + 1, i_fullPathLength)
    xout S_filename
endop

opcode filename_from_full_path_k, S, S
    S_fullPath xin
    k_fullPathLength = strlenk(S_fullPath)
    ki = k_fullPathLength - 1
    k_found = false
    while (k_found == false && k(0) < ki) do
        k_char = strchark(S_fullPath, ki)
        if (k_char == ASCII_CODE__SLASH || k_char == ASCII_CODE__BACKSLASH) then
            k_found = true
        else
            ki -= 1
        endif
    od
    S_filename = strsubk(S_fullPath, ki + 1, k_fullPathLength)
    xout S_filename
endop

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
