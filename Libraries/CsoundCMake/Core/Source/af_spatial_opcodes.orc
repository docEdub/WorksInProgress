#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_af_spatial_opcodes_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_af_spatial_opcodes_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_INCLUDE} "af_spatial_tables.orc"
${CSOUND_INCLUDE} "af_opcodes.orc"
${CSOUND_INCLUDE} "log.orc"
${CSOUND_INCLUDE} "math.orc"
${CSOUND_INCLUDE} "time.orc"

//---------------------------------------------------------------------------------------------------------------------
// File: af_spatial_opcodes.orc
//---------------------------------------------------------------------------------------------------------------------


${CSOUND_DEFINE} AF_3D_AUDIO__AMBISONIC_ORDER_MAX #3#
${CSOUND_DEFINE} AF_3D_AUDIO__SPEED_OF_SOUND #343# // Meters per second at 20 °C

// Use GEN02 to create table #1 for the listener matrix containing 16 values.
// This matrix is set to the BabylonJS camera's matrix in Javascript using the Csound WASM API.
// Note that we use GEN02 with a negative number to prevent Csound's auto-scaling of it's values.
gi_AF_3D_ListenerMatrixTableNumber ftgen 1, 0, 16, -2,   1, 0, 0, 0,   0, 1, 0, 0,   0, 0, 1, 0,   0, 0, 0, 1

// This gets updated by the AF_3D_UpdateListenerRotationMatrix opcode, which should be called in instrument 1
// before accessing the values in this matrix.
gk_AF_3D_ListenerRotationMatrix[] init 9

// This gets updated by the AF_3D_UpdateListenerPosition opcode, which should be called in instrument 1
// before accessing the values in this vector.
// TODO: Improve variable dependency organization.
gk_AF_3D_ListenerPosition[] init 3


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_AzimuthLookupTableRow
//---------------------------------------------------------------------------------------------------------------------
// Returns the given azimuth's spherical harmonics lookup table row.
//
// in  k  : Azimuth in degrees.
//
// out k  : Azimuth spherical harmonics lookup table row.
//
 opcode AF_3D_Audio_AzimuthLookupTableRow, k, k
    k_azimuth xin
    k_azimuth = round(k_azimuth % 360)
    if (k_azimuth < 0) then
        k_azimuth += 360
    elseif (360 <= k_azimuth) then
        k_azimuth -= 360
    endif
    xout k_azimuth
 endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_ElevationLookupTableRow
//---------------------------------------------------------------------------------------------------------------------
// Returns the given elevation's spherical harmonics lookup table row.
//
// in  k  : Elevation in degrees.
//
// out k  : Elevation spherical harmonics lookup table row.
//
 opcode AF_3D_Audio_ElevationLookupTableRow, k, k
    k_elevation xin
    xout min(round(min(90, max(-90, k_elevation))) + 90, 179)
 endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_MaxReWeightsLookupTableRow
//---------------------------------------------------------------------------------------------------------------------
// Returns the given source width's max re weights lookup table row index.
//
// in  k  : Source width in degrees.
//
// out k  : Max re weights lookup table row.
//
 opcode AF_3D_Audio_MaxReWeightsLookupTableRow, k, k
    k_sourceWidth xin
    xout min(max(0, round(k_sourceWidth)), 359)
 endop


 gkAmbisonicChannelGains[] init 4 // first order ambisonics { i_channelCount = (i_ambisonicOrder + 1) * (i_ambisonicOrder + 1) }


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_ChannelGains
//---------------------------------------------------------------------------------------------------------------------
// Returns an array of ambisonic channel gains for the given azimuth, elevation, and source width.
// The number of channel gains returned depends on the given ambisonic order.
//
// in  k  : Azimuth in degrees.
// in  k  : Elevation in degrees.
// in  k  : Source width in degrees.
// in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1.
//
// out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
//
opcode AF_3D_Audio_ChannelGains, 0, kkkp
    kSourceAzimuth, k_elevation, k_sourceWidth, i_ambisonicOrder xin

    kListenerAzimuth = (cosinv(gk_AF_3D_ListenerRotationMatrix[2])) * $AF_MATH__RADIANS_TO_DEGREES
    if (gk_AF_3D_ListenerRotationMatrix[0] < 0) then
        kListenerAzimuth = 360 - kListenerAzimuth
    endif

    k_azimuth = (kSourceAzimuth + 180) % 360
    if (k_azimuth < 0) then
        k_azimuth += 360
    endif
    
    k_azimuthRow = AF_3D_Audio_AzimuthLookupTableRow(k_azimuth)
    k_elevationRow = AF_3D_Audio_ElevationLookupTableRow(k_elevation)
    k_spreadRow = AF_3D_Audio_MaxReWeightsLookupTableRow(k_sourceWidth)

    gkAmbisonicChannelGains[0] = gi_AF_3D_Audio_MaxReWeightsLookupTable[k_spreadRow][0]
    k_i = 1
    while (k_i <= i_ambisonicOrder) do
        k_degreeWeight = gi_AF_3D_Audio_MaxReWeightsLookupTable[k_spreadRow][k_i]
        k_j = -k_i
        while (k_j <= k_i) do
            k_channel = (k_i * k_i) + k_i + k_j
            k_elevationColumn = k_i * (k_i + 1) / 2 + abs(k_j) - 1
            k_gain = gi_AF_3D_Audio_SphericalHarmonicsElevationLookupTable[k_elevationRow][k_elevationColumn]
            if (k_j != 0) then
                if (k_j < 0) then
                    k_azimuthColumn = $AF_3D_AUDIO__AMBISONIC_ORDER_MAX + k_j
                else
                    k_azimuthColumn = $AF_3D_AUDIO__AMBISONIC_ORDER_MAX + k_j - 1
                endif
                if (k_azimuthRow < 180) then
                    k_gain *= gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_000_179 \
                        [k_azimuthRow][k_azimuthColumn]
                else
                    k_gain *= gi_AF_3D_Audio_SphericalHarmonicsAzimuthLookupTable_180_359 \
                        [k_azimuthRow - 180][k_azimuthColumn]
                endif
            endif
            gkAmbisonicChannelGains[k_channel] = k_degreeWeight * k_gain
            k_j += 1
        od
        k_i += 1
    od

    ; if (changed(kListenerAzimuth) == true || changed(k_azimuth) == true || changed(k_elevation) == true) then
    ;     printsk("azimuth = %.03f, gains = [%.03f, %.03f, %.03f, %.03f], m012 = [%.03f, %.03f, %.03f], m345 = [%.03f, %.03f, %.03f], m678 = [%.03f, %.03f, %.03f]\n",
    ;         k_azimuth,
    ;         gkAmbisonicChannelGains[0], gkAmbisonicChannelGains[1], gkAmbisonicChannelGains[2], gkAmbisonicChannelGains[3],
    ;         gk_AF_3D_ListenerRotationMatrix[0], gk_AF_3D_ListenerRotationMatrix[1], gk_AF_3D_ListenerRotationMatrix[2],
    ;         gk_AF_3D_ListenerRotationMatrix[3], gk_AF_3D_ListenerRotationMatrix[4], gk_AF_3D_ListenerRotationMatrix[5],
    ;         gk_AF_3D_ListenerRotationMatrix[6], gk_AF_3D_ListenerRotationMatrix[7], gk_AF_3D_ListenerRotationMatrix[8])
    ; endif
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_ChannelGains
//---------------------------------------------------------------------------------------------------------------------
// Returns an array of ambisonic channel gains for the given position and source width.
// The number of channel gains returned depends on the given ambisonic order.
//
// in  i[]: Source position
// in  k  : Source width in degrees.
// in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1. Orders 2 and 3 are not implemented, yet.
//
// out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
//
opcode AF_3D_Audio_ChannelGains, 0, i[]kp
    i_sourcePosition[], k_sourceWidth, i_ambisonicOrder xin
    
    k_direction[] = fillarray(i_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
        i_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
        i_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Y]) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = taninv2(k_direction[$Z],
        sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])) * $AF_MATH__RADIANS_TO_DEGREES

    AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_ChannelGains
//---------------------------------------------------------------------------------------------------------------------
// Returns an array of ambisonic channel gains for the given position and source width.
// The number of channel gains returned depends on the given ambisonic order.
//
// in  k[]: Source position
// in  k  : Source width in degrees. (k-rate)
// in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1. Orders 2 and 3 are not implemented, yet. (i-time)
//
// out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
//
opcode AF_3D_Audio_ChannelGains, 0, k[]kp
    k_sourcePosition[], k_sourceWidth, i_ambisonicOrder xin
    
    k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
        k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
        k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Y]) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = taninv2(k_direction[$Z],
        sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])) * $AF_MATH__RADIANS_TO_DEGREES

    AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_ChannelGains_XYZ
//---------------------------------------------------------------------------------------------------------------------
// Returns an array of ambisonic channel gains for the given position and source width.
// The number of channel gains returned depends on the given ambisonic order.
//
// in  k  : Source position X.
// in  k  : Source position Y.
// in  k  : Source position Z.
// in  P  : Source width in degrees. Optional. Defaults to 1. (k-rate)
// in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1. Orders 2 and 3 are not implemented, yet. (i-time)
//
// out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
//
opcode AF_3D_Audio_ChannelGains_XYZ, 0, kkkPp
    k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ, k_sourceWidth, i_ambisonicOrder xin

    k_direction[] init 3
    k_direction[$X] = k_sourcePositionX - gk_AF_3D_ListenerPosition[$X]
    k_direction[$Y] = k_sourcePositionY - gk_AF_3D_ListenerPosition[$Y]
    k_direction[$Z] = k_sourcePositionZ - gk_AF_3D_ListenerPosition[$Z]

    ; if (changed(k_direction[$X]) == true || changed(k_direction[$Z]) == true) then
    ;     printsk("k_direction = [%.03f, %.03f, %.03f], ", k_direction[$X], 0, k_direction[$Z])
    ; endif
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Z]) * $AF_MATH__RADIANS_TO_DEGREES

    // Elevation is disabled for now since it complicates the calculations used to smooth out crossing over zero on the
    // x and y axes.
    k_elevation = taninv2(k_direction[$Y],
        sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Z] * k_direction[$Z])) * $AF_MATH__RADIANS_TO_DEGREES

    ; if (changed(k_elevation) == true) then
    ;     printsk("k_elevation = %.03f\n", k_elevation)
    ; fi

    ; #if LOGGING
    ;     if (changed(k_azimuth) == true || changed(k_elevation) == true) then
    ;         log_k_debug("xyz = (%f, %f, %f), azimuth = %f, elevation = %f",
    ;             k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ,
    ;             k_azimuth, k_elevation)
    ;     endif
    ; #endif

    AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)

    // Smooth out crossing over zero on the x and y axes.
    ; i_minW = 0.79021
    ; i_maxW = 1.25
    ; i_diffW = i_maxW - i_minW
    ; k_distance = sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])
    ; if (k_distance <= 1) then
    ;     gkAmbisonicChannelGains[0] = i_maxW
    ;     gkAmbisonicChannelGains[1] = 0
    ;     gkAmbisonicChannelGains[2] = 0
    ;     gkAmbisonicChannelGains[3] = 0
    ; elseif (k_distance <= 2) then
    ;     k_distance -= 1
    ;     gkAmbisonicChannelGains[0] = i_minW + (i_diffW * (1 - k_distance))
    ;     gkAmbisonicChannelGains[1] = gkAmbisonicChannelGains[1] * k_distance
    ;     gkAmbisonicChannelGains[2] = gkAmbisonicChannelGains[2] * k_distance
    ;     gkAmbisonicChannelGains[3] = gkAmbisonicChannelGains[3] * k_distance
    ; endif
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_ChannelGains_RTZ
//---------------------------------------------------------------------------------------------------------------------
// Returns an array of ambisonic channel gains for the given R, T, Z, and source width.
// The number of channel gains returned depends on the given ambisonic order.
//
// in  k  : Source position XY plane radius (needed to calculate the elevation angle).
// in  k  : Source position XY plane theta (aka azimuth).
// in  k  : Source position Z.
// in  P  : Source width in degrees. Optional. Defaults to 1. (k-rate)
// in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1. Orders 2 and 3 are not implemented, yet. (k-rate)
//
// out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
//
opcode AF_3D_Audio_ChannelGains_RTZ, 0, kkkPp
    k_sourcePositionR, k_sourcePositionT, k_sourcePositionZ, k_sourceWidth, i_ambisonicOrder xin

    // Covert RT to XY.
    k_sourcePositionX = k_sourcePositionR * cos(k_sourcePositionT)
    k_sourcePositionY = k_sourcePositionR * sin(k_sourcePositionT)
    k_elevation = taninv2(k_sourcePositionZ, k_sourcePositionR) * $AF_MATH__RADIANS_TO_DEGREES

    #if LOGGING
        if (changed(k_sourcePositionX) == true || changed(k_sourcePositionY) == true) then
            log_k_trace("rtz = (%f, %f, %f), xyz = (%f, %f, %f)",
                k_sourcePositionR, k_sourcePositionT, k_sourcePositionZ,
                k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ)
        endif
    #endif

    AF_3D_Audio_ChannelGains_XYZ(k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ, k_sourceWidth,
        i_ambisonicOrder)
endop

; giDistanceAttenuationTable = ftgen(0, 0, 513, GEN06, 1, 32, 1, 128, 0.5, 353, 0)

;                                    f1 0  101  8    1    5  .99    20  0.55    25  0.23    40  0.01    10  0
; giDistanceAttenuationTable = ftgen(0, 0, 101, 8,   1,   5, .99,   20, 0.55,   25, 0.23,   40, 0.01,   10, 0)

;                                  f1 0  101  5  1  100  0.0001
; giDistanceAttenuationTable = ftgen(0, 0, 101, 5, 1, 100, 0.0001)

;                               f1 0, 0, 101, 25    0  1    5  1    90  0.01    95  0.005    100  0.001
; giDistanceAttenuationTable = ftgen(0, 0, 101, 25,   0, 1,   5, 1,   90, 0.01,   95, 0.005,   100, 0.001)

;                               f1 0     251  25    0  1    5  1    250  0.00001
giDistanceAttenuationTable = ftgen(0, 0, 251, 25,   0, 1,   5, 1,   250, 0.00001)
//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_DistanceAttenuation
//---------------------------------------------------------------------------------------------------------------------
// Returns the attenuation for the given distance using the inverse distance model.
// See https://medium.com/@kfarr/understanding-web-audio-api-positional-audio-distance-models-for-webxr-e77998afcdff
// See https://www.desmos.com/calculator/lzxfqvwoqq
//
// in  k  : Distance.
// in  p  : Reference distance. Defaults to 1.
// in  p  : Rolloff factor. Default to 1.
//
// out k  : Attenuation.
//
opcode AF_3D_Audio_DistanceAttenuation, k, kpp
    kDistance, iReferenceDistance, iRolloffFactor xin
    kAttenuation = k(iReferenceDistance) / ((max(kDistance, iReferenceDistance) - iReferenceDistance) * iRolloffFactor + iReferenceDistance)
    ; if (changed(kAttenuation) == true) then
    ;     printsk("%.03f, %.03f\n", kDistance, kAttenuation)
    ; endif
    xout kAttenuation
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_DistanceAttenuation
//---------------------------------------------------------------------------------------------------------------------
// Returns the logarithmic attenuation for the given distance.
//
// in  k  : Distance.
// in  k  : Maximum distance.
//
// out k  : Attenuation.
//
opcode AF_3D_Audio_DistanceAttenuation, k, kk
    kDistance, kMaxDistance xin
    xout tablei(kDistance / kMaxDistance, giDistanceAttenuationTable, TABLEI_NORMALIZED_INDEX_MODE)
    //xout kDistance / kMaxDistance
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_DistanceAttenuation
//---------------------------------------------------------------------------------------------------------------------
// Returns the logarithmic attenuation for the given distance.
//
// in  i  : Distance.
// in  i  : Minimum distance.
// in  i  : Maximum distance.
//
// out i  : Attenuation.
//
opcode AF_3D_Audio_DistanceAttenuation_i, i, iii
    // TODO: Try changing this opcode to use a predefined curve instead of a logarithmic spike when objects are close.
    // Objects passing directly thru the camera are zippering and popping. Try a predefined curve instead of raw math.
    i_distance, i_minDistance, i_maxDistance xin
    i_linearFadeOutDistance = i_maxDistance - 1
    if (i_linearFadeOutDistance < i_distance) then
        i_fadeOutDistance = i_distance - i_linearFadeOutDistance
        if (i_fadeOutDistance < 1) then
            i_linearFadeFrom = 1 / i_maxDistance
            i_gain = i_linearFadeFrom * (1 - i_fadeOutDistance)
        else
            i_gain = 0
        endif
    else
        i_gain = 1 / (max(i_minDistance, i_distance) + 1)
    endif
    xout i_gain
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_SourceDistance
//---------------------------------------------------------------------------------------------------------------------
// Returns the distance and direction from the listener to the given source position.
//
// in  i: Source's position x.
// in  i: Source's position y.
// in  i: Source's position z.
//
// out k  : Distance from listener to given source position.
//
opcode AF_3D_Audio_SourceDistance, k, iii
    iSourcePositionX, iSourcePositionY, iSourcePositionZ xin
    kVector[] init 3
    kVector[$X] = iSourcePositionX - gk_AF_3D_ListenerPosition[$X]
    kVector[$Y] = iSourcePositionY - gk_AF_3D_ListenerPosition[$Y]
    kVector[$Z] = iSourcePositionZ - gk_AF_3D_ListenerPosition[$Z]

    xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_SourceDistance
//---------------------------------------------------------------------------------------------------------------------
// Returns the distance and direction from the listener to the given source position.
//
// in  k: Source's position x.
// in  k: Source's position y.
// in  k: Source's position z.
//
// out k  : Distance from listener to given source position.
//
opcode AF_3D_Audio_SourceDistance, k, kkk
    kSourcePositionX, kSourcePositionY, kSourcePositionZ xin
    kVector[] init 3
    kVector[$X] = kSourcePositionX - gk_AF_3D_ListenerPosition[$X]
    kVector[$Y] = kSourcePositionY - gk_AF_3D_ListenerPosition[$Y]
    kVector[$Z] = kSourcePositionZ - gk_AF_3D_ListenerPosition[$Z]

    xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_SourceDistance
//---------------------------------------------------------------------------------------------------------------------
// Returns the distance and direction from the listener to the given source position.
//
// in  i[]: Source's position [x, y, z].
//
// out k  : Distance from listener to given source position.
//
opcode AF_3D_Audio_SourceDistance, k, i[]
    iSourcePosition[] xin
    kVector[] init 3
    kVector[$X] = iSourcePosition[$X] - gk_AF_3D_ListenerPosition[$X]
    kVector[$Y] = iSourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y]
    kVector[$Z] = iSourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z]

    xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_SourceDistance
//---------------------------------------------------------------------------------------------------------------------
// Returns the distance and direction from the listener to the given source position.
//
// in  k[]: Source's position [x, y, z].
//
// out k  : Distance from listener to given source position.
//
opcode AF_3D_Audio_SourceDistance, k, k[]
    kSourcePosition[] xin

    kVector[] init 3
    kVector[$X] = kSourcePosition[$X] - gk_AF_3D_ListenerPosition[$X]
    kVector[$Y] = kSourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y]
    kVector[$Z] = kSourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z]

    xout sqrt(kVector[$X] * kVector[$X] + kVector[$Y] * kVector[$Y] + kVector[$Z] * kVector[$Z])
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_SourceDirection
//---------------------------------------------------------------------------------------------------------------------
// Returns the direction from the listener to the given source position.
//
// in  k[]: Source's position [x, y, z].
//
// out k[]: Normalized direction vector from listener to given source position.
//
opcode AF_3D_Audio_SourceDirection, k[], k[]
    k_sourcePosition[] xin
    
    // Calculate distance to listener.
    k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
        k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
        k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])

    // Normalize direction vector.
    k_distance = sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y] \
        + k_direction[$Z] * k_direction[$Z])
    if (0 < k_distance) then
        k_direction /= k_distance
    endif

    xout k_direction
endop


//---------------------------------------------------------------------------------------------------------------------
// AF_3D_Audio_DopplerShift
//---------------------------------------------------------------------------------------------------------------------
//
// in  k  : The previous distance between the sound source and the listener.
// in  k  : The current distance between the sound source and the listener.
// in  k  : The time in seconds it took to move from the previous distance to the current distance.
//
// out k  : The amount of doppler shift calculated by comparing the given distance to the previously given distance.
//
opcode AF_3D_Audio_DopplerShift, k, kkk
    k_previousDistance, k_currentDistance, k_deltaTime xin

    k_dopplerShift init 1

    // Calculate doppler shift.
    if (0 < k_deltaTime) then
        k_deltaDistance = k_currentDistance - k_previousDistance
        k_velocity = k_deltaDistance / k_deltaTime
        k_dopplerShift = port($AF_3D_AUDIO__SPEED_OF_SOUND / ($AF_3D_AUDIO__SPEED_OF_SOUND + k_velocity),
            $AF_3D_FRAME_DURATION_OVER_2, 1)
    endif

    xout k_dopplerShift
endop


${CSOUND_INCLUDE_GUARD_ENDIF}
