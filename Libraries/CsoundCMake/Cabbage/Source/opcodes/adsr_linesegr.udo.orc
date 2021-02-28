
#include "definitions.h"

${CSOUND_IFNDEF} ADSR_LINESEGR_UDO_ORC
${CSOUND_DEFINE} ADSR_LINESEGR_UDO_ORC ##

opcode adsr_linsegr, a, iiii
    iA, iD, iS, iR xin
    iA = max(FLOAT_MIN, iA)
    iD = max(FLOAT_MIN, iD)
    iR = max(FLOAT_MIN, iR)
    aOut = linsegr(0, iA, 1, iD, iS, 1, iS, iR, 0)
    xout aOut
endop

${CSOUND_ENDIF}
