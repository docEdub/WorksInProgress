
#include "definitions.h"

${CSOUND_IFNDEF} ADSR_LINSEGR_UDO_ORC
${CSOUND_DEFINE} ADSR_LINSEGR_UDO_ORC ##

opcode adsr_linsegr, a, iiii
    iA, iD, iS, iR xin
    iA = max(FLOAT_MIN, iA)
    iD = max(FLOAT_MIN, iD)
    iR = max(FLOAT_MIN, iR)
    aOut = linsegr(0, iA, 1, iD, iS, 1, iS, iR, 0)
    xout aOut
endop

opcode adsr_linsegr, k, kkkk
    iA, iD, iS, iR xin
    iA = max(FLOAT_MIN, iA)
    iD = max(FLOAT_MIN, iD)
    iR = max(FLOAT_MIN, iR)
    kOut = linsegr(0, iA, 1, iD, iS, 1, iS, iR, 0)
    xout kOut
endop

${CSOUND_ENDIF}
