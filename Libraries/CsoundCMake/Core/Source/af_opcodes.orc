#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_af_opcodes_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_af_opcodes_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}


/**********************************************************************************************************************
 * File: af_opcodes.orc
 *********************************************************************************************************************/

${CSOUND_DEFINE} X #0#
${CSOUND_DEFINE} Y #1#
${CSOUND_DEFINE} Z #2#

${CSOUND_DEFINE} R #0#
${CSOUND_DEFINE} T #1#

${CSOUND_DEFINE} AF_FALSE #0#
${CSOUND_DEFINE} AF_TRUE #1#

${CSOUND_DEFINE} AF_EPSILON_FLOAT #0.00000001#

${CSOUND_DEFINE} AF_MATH__PI  #3.1419527#
${CSOUND_DEFINE} AF_MATH__PI2 #6.2831853#
${CSOUND_DEFINE} AF_MATH__PI_OVER_180 #0.01745329#
${CSOUND_DEFINE} AF_MATH__180_OVER_PI #57.29577951#

${CSOUND_DEFINE} AF_MATH__DEGREES_TO_RADIANS #$AF_MATH__PI_OVER_180#
${CSOUND_DEFINE} AF_MATH__RADIANS_TO_DEGREES #$AF_MATH__180_OVER_PI#

${CSOUND_DEFINE} AF_3D_FRAME_DURATION #0.01666667# // 1/60th of a second
; ${CSOUND_DEFINE} AF_3D_FRAME_DURATION_OVER_2 #0.00833333# // 1/60th of a second divided by 2
${CSOUND_DEFINE} AF_3D_FRAME_DURATION_OVER_2 #0.05# // Same as audio context buffer size in browsers that support it.


/**********************************************************************************************************************
 * AF_FuzzyEqual
 **********************************************************************************************************************
 * Returns $AF_TRUE if the given values are close to equal; otherwise returns $AF_FALSE.
 *
 * in  k  : Value to compare with other value.
 * in  k  : Value to compare with other value.
 *
 * out k  : $AF_TRUE if the given values are close to equal; otherwise $AF_FALSE.
 */
opcode AF_FuzzyEqual, k, kk
    k_a, k_b xin
    k_equal = $AF_TRUE
    if ($AF_EPSILON_FLOAT < abs(k_b - k_a)) then
        k_equal = $AF_FALSE
    endif
    xout k_equal
endop


/**********************************************************************************************************************
 * AF_Math_RadiansFromDegrees
 **********************************************************************************************************************
 *
 * in  k  : Degrees.
 *
 * out k  : Radians.
 */
opcode AF_Math_RadiansFromDegrees, k, k
    k_degrees xin
    xout k_degrees * $AF_MATH__DEGREES_TO_RADIANS
endop


/**********************************************************************************************************************
 * AF_Math_DegreesFromRadians
 **********************************************************************************************************************
 *
 * in  k  : Radians.
 *
 * out k  : Degrees.
 */
opcode AF_Math_DegreesFromRadians, k, k
    k_radians xin
    xout k_radians * $AF_MATH__DEGREES_TO_RADIANS
endop


opcode AF_Math_Sin, k, k
    k_degrees xin
    xout sin(AF_Math_RadiansFromDegrees(k_degrees))
endop


opcode AF_Math_Cos, k, k
    k_degrees xin
    xout cos(AF_Math_RadiansFromDegrees(k_degrees))
endop


/**********************************************************************************************************************
 * AF_GetInstrumentId
 **********************************************************************************************************************
 * Returns the given float input as an instrument id string.
 *
 * in  i  : Instrument's p1 value.
 *
 * out S  : Instrument's p1 value formatted as a string enclosed in square brackets, i.e. "[i,s]" where 'i' is the
 *          instrument number and 's' is the sub-instrument number.
 */
opcode AF_GetInstrumentId, S, 0
    xout sprintf("[%.0f,%d]", p1, (p1 - floor(p1)) * 1000)
endop


/**********************************************************************************************************************
 * AF_SendInstrumentOnMessage
 **********************************************************************************************************************
 * Sends an instrument 'on' message to Javascript.
 *
 * in  S  : Instrument's id.
 * in  i  : Instrument's start time.
 * in  j  : Instrument's duration. Defaults to -1.
 */
opcode AF_SendInstrumentOnMessage, 0, Sij
    S_instrumentId, i_startTime, i_duration xin
    if (-1 == i_duration) then
        prints("{\"csd\":{\"i\":{\"id\":%s,\"on\":1,\"startTime\":%f}}}\n", S_instrumentId, i_startTime)
    else
        prints("{\"csd\":{\"i\":{\"id\":%s,\"on\":1,\"startTime\":%f,\"duration\":%f}}}\n", S_instrumentId,
            i_startTime, i_duration)
    endif
endop


/**********************************************************************************************************************
 * AF_CreateKChannel
 **********************************************************************************************************************
 * Creates a k channel with the given channel name.
 *
 * in  S  : Channel name.
 * in  o  : Optional default value. Zero if not set.
 */
opcode AF_CreateKChannel, 0, So
    S_channelName, i_defaultValue xin
    chn_k S_channelName, 3, 0, i_defaultValue
endop


/**********************************************************************************************************************
 * AF_GetKChannel
 **********************************************************************************************************************
 * Get the specified k channel's value.
 *
 * in  S  : Channel name.
 *
 * out k  : Channel value.
 */
opcode AF_GetKChannel, k, S
    S_channelName xin
    k_channelValue chnget S_channelName
    xout k_channelValue
endop


/**********************************************************************************************************************
 * AF_SetKChannel
 **********************************************************************************************************************
 * Set the specified k channel's value to the given value.
 *
 * in  S  : Channel name.
 * in  k  : Channel value.
 */
opcode AF_SetKChannel, 0, Sk
    S_channelName, k_channelValue xin
    chnset k_channelValue, S_channelName
endop


${CSOUND_INCLUDE_GUARD_ENDIF}
