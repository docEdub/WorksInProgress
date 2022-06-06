#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_af_global_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_af_global_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

// TODO: This include order is wack. Files starting with af_spatial should be including files starting with af_, not ...
// vice-versa.
${CSOUND_INCLUDE} "core_global.orc"
${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
${CSOUND_INCLUDE} "time.orc"

//---------------------------------------------------------------------------------------------------------------------
// File: af_global.orc
//---------------------------------------------------------------------------------------------------------------------


// The sample rate, control rate, and number of channels are all set by the Csound WASM WebAudio node.
// TODO: Set 'ksmps' programatically based on the sample rate. This currently assumes a sample rate of 48000.
//ksmps = 120


// Set the audio peak to 1.0. Audio signal output should not exceed this value's bipolar range [-1, 1].
// TODO: Try setting 0dbfs in the Csound WASM WebAudio node instead of a .csd file.
//0dbfs = 1


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_UpdateListenerRotationMatrix
//---------------------------------------------------------------------------------------------------------------------
// Sets the global listener rotation matrix to the global listener matrix table updated by Javascript.
//
opcode AF_3D_UpdateListenerRotationMatrix, 0, 0

    ; kM11 = tab:k(0, gi_AF_3D_ListenerMatrixTableNumber)
    ; if (changed(kM11) == true) then
    ;     printsk("listener azimuth = %.03f\n", sininv(kM11) * $AF_MATH__RADIANS_TO_DEGREES)
    ; endif

    ; kChanged = false
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[0]) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[1]) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[2]) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[3]) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[4]) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[5]) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[6]) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[7]) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(gk_AF_3D_ListenerRotationMatrix[8]) == true) then
    ;     kChanged = true
    ; endif

    ; kPrinted init false
    ; if (kChanged == true) then
    ;     kPrinted = false
    ; endif

    ; if (kChanged == false && kPrinted == false) then
    ;     printsk("gk_AF_3D_ListenerRotationMatrix ...\n")
    ;     printsk("[%.3f, %.3f, %.3f]\n", gk_AF_3D_ListenerRotationMatrix[0], gk_AF_3D_ListenerRotationMatrix[1], gk_AF_3D_ListenerRotationMatrix[2])
    ;     printsk("[%.3f, %.3f, %.3f]\n", gk_AF_3D_ListenerRotationMatrix[3], gk_AF_3D_ListenerRotationMatrix[4], gk_AF_3D_ListenerRotationMatrix[5])
    ;     printsk("[%.3f, %.3f, %.3f]\n", gk_AF_3D_ListenerRotationMatrix[6], gk_AF_3D_ListenerRotationMatrix[7], gk_AF_3D_ListenerRotationMatrix[8])
    ;     kPrinted = true
    ; endif
    gk_AF_3D_ListenerRotationMatrix[0] = tab:k(0, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[1] = tab:k(1, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[2] = tab:k(2, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[3] = tab:k(4, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[4] = tab:k(5, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[5] = tab:k(6, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[6] = tab:k(8, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[7] = tab:k(9, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerRotationMatrix[8] = tab:k(10, gi_AF_3D_ListenerMatrixTableNumber)
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_UpdateListenerPosition
//---------------------------------------------------------------------------------------------------------------------
// Sets the global listener position vector to the global listener matrix table updated by Javascript.
//
opcode AF_3D_UpdateListenerPosition, 0, 0

    ; kChanged = false
    ; if (changed(kX) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(kY) == true) then
    ;     kChanged = true
    ; endif
    ; if (changed(kZ) == true) then
    ;     kChanged = true
    ; endif
    ; if (kChanged == true) then
    ;     printsk("%s: Raw Csound listener position = [%.3f, %.3f, %.3f]\n", time_string_k(), kX, kY, kZ)
    ; endif
    gk_AF_3D_ListenerPosition[0] = tab:k(12, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerPosition[1] = tab:k(13, gi_AF_3D_ListenerMatrixTableNumber)
    gk_AF_3D_ListenerPosition[2] = tab:k(14, gi_AF_3D_ListenerMatrixTableNumber)
endop


// The 4 ambisonic outputs sent to the Csound WebAudio node in ACN order for conversion to stereo by the last Csound
// instrument (the Csound instrument with the highest instrument number).
ga_AF_3D_AmbisonicOutput[] init 4


//---------------------------------------------------------------------------------------------------------------------
// AF_Ambisonics_Send
//---------------------------------------------------------------------------------------------------------------------
// Calculates the given signal's ambisonic outputs and adds them to the global ambisonic send variable.
//
// in  a  : Signal to send.
// in  i[]: Signal's position
// in  P  : Signal's width in degrees. Optional. Defaults to 1.
//
opcode AF_Ambisonics_Send, 0, ai[]P
    a_signal, i_position[], k_width xin

    // Get the ambisonic channel gains.
    AF_3D_Audio_ChannelGains(i_position, k_width)

    // Mix the ambisonic channel gains into the global ambisonic outputs.
    ga_AF_3D_AmbisonicOutput[0] = ga_AF_3D_AmbisonicOutput[0] + (gkAmbisonicChannelGains[0] * a_signal)
    ga_AF_3D_AmbisonicOutput[1] = ga_AF_3D_AmbisonicOutput[1] + (gkAmbisonicChannelGains[1] * a_signal)
    ga_AF_3D_AmbisonicOutput[2] = ga_AF_3D_AmbisonicOutput[2] + (gkAmbisonicChannelGains[2] * a_signal)
    ga_AF_3D_AmbisonicOutput[3] = ga_AF_3D_AmbisonicOutput[3] + (gkAmbisonicChannelGains[3] * a_signal)
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_Ambisonics_Send
//---------------------------------------------------------------------------------------------------------------------
// Calculates the given signal's ambisonic outputs and adds them to the global ambisonic send variable.
//
// in  a  : Signal to send.
// in  k[]: Signal's position
// in  P  : Signal's width in degrees. Optional. Defaults to 1.
//
opcode AF_Ambisonics_Send, 0, ak[]P
    a_signal, k_position[], k_width xin

    // Get the ambisonic channel gains.
    AF_3D_Audio_ChannelGains(k_position, k_width)

    // Mix the ambisonic channel gains into the global ambisonic outputs.
    ga_AF_3D_AmbisonicOutput[0] = ga_AF_3D_AmbisonicOutput[0] + (gkAmbisonicChannelGains[0] * a_signal)
    ga_AF_3D_AmbisonicOutput[1] = ga_AF_3D_AmbisonicOutput[1] + (gkAmbisonicChannelGains[1] * a_signal)
    ga_AF_3D_AmbisonicOutput[2] = ga_AF_3D_AmbisonicOutput[2] + (gkAmbisonicChannelGains[2] * a_signal)
    ga_AF_3D_AmbisonicOutput[3] = ga_AF_3D_AmbisonicOutput[3] + (gkAmbisonicChannelGains[3] * a_signal)
endop


// The reverb input signal sent to the reverb opcode and then the Csound WebAudio node.
ga_AF_Reverb_Send init 0


//---------------------------------------------------------------------------------------------------------------------
// AF_Reverb
//---------------------------------------------------------------------------------------------------------------------
// Adds the given signal to the global reverb send variable.
//
// in  a  : Signal to reverberate.
//
opcode AF_Reverb_Send, 0, a
    a_signal xin
    ga_AF_Reverb_Send += a_signal
endop


${CSOUND_INCLUDE_GUARD_ENDIF}
