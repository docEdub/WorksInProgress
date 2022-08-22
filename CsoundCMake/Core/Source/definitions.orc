#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_definitions_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_definitions_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}


//---------------------------------------------------------------------------------------------------------------------
// File: definitions.orc
//---------------------------------------------------------------------------------------------------------------------


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
${CSOUND_DEFINE} AF_3D_FRAME_DURATION_OVER_2 #0.001# // Same as audio context buffer size in browsers that support it.

${CSOUND_DEFINE} AF_3D_LISTENER_LAG_TIME #0.025#
${CSOUND_DEFINE} AF_3D_LISTENER_LAG_SAMPLES #1200#


${CSOUND_INCLUDE_GUARD_ENDIF}
