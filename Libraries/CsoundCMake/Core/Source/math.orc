#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_math_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_math_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

//----------------------------------------------------------------------------------------------------------------------
// File: math.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "definitions.orc"

opcode math_roundFloat_k, k, ki
    k_inputFloat, i_decimalPlaces xin
    k_outputFloat = k_inputFloat
    if (i_decimalPlaces == 0) then
        k_outputFloat = round(k_inputFloat)
    else
        i_10ToTheDecimalPlacesPower = pow(10, i_decimalPlaces)
        k_outputFloat = int(k_inputFloat)
        k_outputFloat += int(round(frac(k_inputFloat) * i_10ToTheDecimalPlacesPower)) / i_10ToTheDecimalPlacesPower
    endif
    xout k_outputFloat
endop

giFastSquareMaxI init 101
giFastSquareTable ftgen 0, 0, giFastSquareMaxI, 2, 0

instr math_InitFastSquareTable
    iI = 0
    while (iI < giFastSquareMaxI) do
        tablew(iI * iI, iI, giFastSquareTable)
        iI += 1
    od
    turnoff
endin

scoreline_i("i \"math_InitFastSquareTable\" 0 -1")

opcode math_fastSquare, i, i
    ii xin
    xout tablei(ii, giFastSquareTable)
endop

opcode math_fastSquare, k, k
    ki xin
    xout tablei(ki, giFastSquareTable)
endop

giFastSqrtMaxI init 10001
giFastSqrtTable ftgen 0, 0, giFastSqrtMaxI, 2, 0

instr math_InitFastSqrtTables
    iI = 0
    while (iI < giFastSqrtMaxI) do
        tablew(sqrt(iI), iI, giFastSqrtTable)
        iI += 1
    od
    turnoff
endin

scoreline_i("i \"math_InitFastSqrtTables\" 0 -1")

opcode math_fastSqrt, i, i
    ii xin
    xout tablei(ii, giFastSqrtTable)
endop

opcode math_fastSqrt, k, k
    ki xin
    xout tablei(ki, giFastSqrtTable)
endop


opcode math_rytToXyz, i[], iii
    iR, iY, iT xin
    iXyz[] init 3
    iXyz[$X] = iR * sin(iT)
    iXyz[$Y] = iY
    iXyz[$Z] = iR * cos(iT)
    xout iXyz
endop

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
