#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: math.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_math_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_math_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

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

${CSOUND_INCLUDE_GUARD_ENDIF}

//----------------------------------------------------------------------------------------------------------------------
