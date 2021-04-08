#include "definitions.h"

${CSOUND_INCLUDE_GUARD_IFNDEF} CsoundCMake_af_spatial_opcodes_orc
${CSOUND_INCLUDE_GUARD_DEFINE} CsoundCMake_af_spatial_opcodes_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

${CSOUND_INCLUDE} "af_spatial_tables.orc"
${CSOUND_INCLUDE} "af_opcodes.orc"
${CSOUND_INCLUDE} "log.orc"
${CSOUND_INCLUDE} "time.orc"

/**********************************************************************************************************************
 * File: af_spatial_opcodes.orc
 *********************************************************************************************************************/


${CSOUND_DEFINE} AF_3D_AUDIO__AMBISONIC_ORDER_MAX #3#
${CSOUND_DEFINE} AF_3D_AUDIO__SPEED_OF_SOUND #343# // Meters per second at 20 °C


// This gets updated by the AF_3D_UpdateListenerPosition opcode, which should be called in instrument 1
// before accessing the values in this vector.
// TODO: Improve variable dependency organization.
gk_AF_3D_ListenerPosition[] init 3


/**********************************************************************************************************************
 * AF_3D_Audio_AzimuthLookupTableRow
 **********************************************************************************************************************
 * Returns the given azimuth's spherical harmonics lookup table row.
 *
 * in  k  : Azimuth in degrees.
 *
 * out k  : Azimuth spherical harmonics lookup table row.
 */
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


/**********************************************************************************************************************
 * AF_3D_Audio_ElevationLookupTableRow
 **********************************************************************************************************************
 * Returns the given elevation's spherical harmonics lookup table row.
 *
 * in  k  : Elevation in degrees.
 *
 * out k  : Elevation spherical harmonics lookup table row.
 */
 opcode AF_3D_Audio_ElevationLookupTableRow, k, k
    k_elevation xin
    xout min(round(min(90, max(-90, k_elevation))) + 90, 179)
 endop


/**********************************************************************************************************************
 * AF_3D_Audio_MaxReWeightsLookupTableRow
 **********************************************************************************************************************
 * Returns the given source width's max re weights lookup table row index.
 *
 * in  k  : Source width in degrees.
 *
 * out k  : Max re weights lookup table row.
 */
 opcode AF_3D_Audio_MaxReWeightsLookupTableRow, k, k
    k_sourceWidth xin
    xout min(max(0, round(k_sourceWidth)), 359)
 endop


/**********************************************************************************************************************
 * AF_3D_Audio_ChannelGains
 **********************************************************************************************************************
 * Returns an array of ambisonic channel gains for the given azimuth, elevation, and source width.
 * The number of channel gains returned depends on the given ambisonic order.
 *
 * in  k  : Azimuth in degrees.
 * in  k  : Elevation in degrees.
 * in  k  : Source width in degrees.
 * in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1.
 *
 * out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
 */
opcode AF_3D_Audio_ChannelGains, k[], kkkp
    k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder xin

    k_azimuth = 360 - k_azimuth
    k_azimuthRow = AF_3D_Audio_AzimuthLookupTableRow(k_azimuth)
    k_elevationRow = AF_3D_Audio_ElevationLookupTableRow(k_elevation)
    k_spreadRow = AF_3D_Audio_MaxReWeightsLookupTableRow(k_sourceWidth)
    
    i_channelCount = (i_ambisonicOrder + 1) * (i_ambisonicOrder + 1)

    k_channelGains[] init i_channelCount
    k_channelGains[0] = gi_AF_3D_Audio_MaxReWeightsLookupTable[k_spreadRow][0]
    k_i = 0
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
            k_channelGains[k_channel] = k_degreeWeight * k_gain
            k_j += 1
        od
        k_i += 1
    od

    xout k_channelGains
endop


/**********************************************************************************************************************
 * AF_3D_Audio_ChannelGains
 **********************************************************************************************************************
 * Returns an array of ambisonic channel gains for the given position and source width.
 * The number of channel gains returned depends on the given ambisonic order.
 *
 * in  i[]: Source position
 * in  k  : Source width in degrees.
 * in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1. Orders 2 and 3 are not implemented, yet.
 *
 * out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
 */
opcode AF_3D_Audio_ChannelGains, k[], i[]kp
    i_sourcePosition[], k_sourceWidth, i_ambisonicOrder xin
    
    k_direction[] = fillarray(i_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
        i_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
        i_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Y]) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = taninv2(k_direction[$Z],
        sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])) * $AF_MATH__RADIANS_TO_DEGREES

    xout AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
endop


/**********************************************************************************************************************
 * AF_3D_Audio_ChannelGains
 **********************************************************************************************************************
 * Returns an array of ambisonic channel gains for the given position and source width.
 * The number of channel gains returned depends on the given ambisonic order.
 *
 * in  k[]: Source position
 * in  k  : Source width in degrees. (k-rate)
 * in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1. Orders 2 and 3 are not implemented, yet. (i-time)
 *
 * out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
 */
opcode AF_3D_Audio_ChannelGains, k[], k[]kp
    k_sourcePosition[], k_sourceWidth, i_ambisonicOrder xin
    
    k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
        k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
        k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Y]) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = taninv2(k_direction[$Z],
        sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])) * $AF_MATH__RADIANS_TO_DEGREES

    xout AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)
endop


/**********************************************************************************************************************
 * AF_3D_Audio_ChannelGains_XYZ
 **********************************************************************************************************************
 * Returns an array of ambisonic channel gains for the given position and source width.
 * The number of channel gains returned depends on the given ambisonic order.
 *
 * in  k  : Source position X.
 * in  k  : Source position Y.
 * in  k  : Source position Z.
 * in  P  : Source width in degrees. Optional. Defaults to 1. (k-rate)
 * in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1. Orders 2 and 3 are not implemented, yet. (i-time)
 *
 * out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
 */
opcode AF_3D_Audio_ChannelGains_XYZ, k[], kkkPp
    k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ, k_sourceWidth, i_ambisonicOrder xin

    k_direction[] = fillarray(k_sourcePositionX - gk_AF_3D_ListenerPosition[$X],
        k_sourcePositionY - gk_AF_3D_ListenerPosition[$Y],
        k_sourcePositionZ - gk_AF_3D_ListenerPosition[$Z])
    k_azimuth = taninv2(k_direction[$X], -k_direction[$Y]) * $AF_MATH__RADIANS_TO_DEGREES

    // Elevation is disable for now since it complicates the calculations used to smooth out crossing over zero on the x
    // and y axes.
    ; k_elevation = taninv2(k_direction[$Z],
    ;     sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])) * $AF_MATH__RADIANS_TO_DEGREES
    k_elevation = 0

    #if LOGGING
        if (changed(k_azimuth) == true || changed(k_elevation) == true) then
            log_k_debug("xyz = (%f, %f, %f), azimuth = %f, elevation = %f",
                k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ,
                k_azimuth, k_elevation)
        endif
    #endif

    k_channelGains[] = AF_3D_Audio_ChannelGains(k_azimuth, k_elevation, k_sourceWidth, i_ambisonicOrder)

    // Smooth out crossing over zero on the x and y axes.
    i_minW = 0.79021
    i_maxW = 1.25
    i_diffW = i_maxW - i_minW
    k_distance = sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y])
    if (k_distance <= 1) then
        k_channelGains[0] = i_maxW
        k_channelGains[1] = 0
        k_channelGains[2] = 0
        k_channelGains[3] = 0
    elseif (k_distance <= 2) then
        k_distance -= 1
        k_channelGains[0] = i_minW + (i_diffW * (1 - k_distance))
        k_channelGains[1] = k_channelGains[1] * k_distance
        k_channelGains[2] = k_channelGains[2] * k_distance
        k_channelGains[3] = k_channelGains[3] * k_distance
    endif

    xout k_channelGains
endop


/**********************************************************************************************************************
 * AF_3D_Audio_ChannelGains_RTZ
 **********************************************************************************************************************
 * Returns an array of ambisonic channel gains for the given R, T, Z, and source width.
 * The number of channel gains returned depends on the given ambisonic order.
 *
 * in  k  : Source position XY plane radius (needed to calculate the elevation angle).
 * in  k  : Source position XY plane theta (aka azimuth).
 * in  k  : Source position Z.
 * in  P  : Source width in degrees. Optional. Defaults to 1. (k-rate)
 * in  p  : Ambisonic order (1, 2, or 3). Optional. Defaults to 1. Orders 2 and 3 are not implemented, yet. (k-rate)
 *
 * out k[]: Ambisonic channel gains. 1st order = 4 channels. 2nd order = 9 channels. 3rd order = 16 channels.
 */
opcode AF_3D_Audio_ChannelGains_RTZ, k[], kkkPp
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

    k_channelGains[] = AF_3D_Audio_ChannelGains_XYZ(k_sourcePositionX, k_sourcePositionY, k_sourcePositionZ,
        i_ambisonicOrder)

    xout k_channelGains
endop


/**********************************************************************************************************************
 * AF_3D_Audio_DistanceAttenuation
 **********************************************************************************************************************
 * Returns the logarithmic attenuation for the given distance.
 *
 * in  k  : Distance.
 * in  k  : Minimum distance.
 * in  k  : Maximum distance.
 *
 * out k  : Attenuation.
 */
opcode AF_3D_Audio_DistanceAttenuation, k, kkk
    // TODO: Try changing this opcode to use a predefined curve instead of a logarithmic spike when objects are close.
    // Objects passing directly thru the camera are zippering and popping. Try a predefined curve instead of raw math.
    k_distance, k_minDistance, k_maxDistance xin
    k_linearFadeOutDistance = k_maxDistance - 1
    if (k_linearFadeOutDistance < k_distance) then
        k_fadeOutDistance = k_distance - k_linearFadeOutDistance
        if (k_fadeOutDistance < 1) then
            k_linearFadeFrom = 1 / k_maxDistance
            k_gain = k_linearFadeFrom * (1 - k_fadeOutDistance)
        else
            k_gain = 0
        endif
    else
        k_gain = 1 / (max(k_minDistance, k_distance) + 1)
    endif
    xout k_gain
endop


/**********************************************************************************************************************
 * AF_3D_Audio_DistanceAttenuation
 **********************************************************************************************************************
 * Returns the logarithmic attenuation for the given distance.
 *
 * in  i  : Distance.
 * in  i  : Minimum distance.
 * in  i  : Maximum distance.
 *
 * out i  : Attenuation.
 */
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


/**********************************************************************************************************************
 * AF_3D_Audio_SourceDistance
 **********************************************************************************************************************
 * Returns the distance and direction from the listener to the given source position.
 *
 * in  i[]: Source's position [x, y, z].
 *
 * out k  : Distance from listener to given source position.
 */
opcode AF_3D_Audio_SourceDistance, k, i[]
    i_sourcePosition[] xin

    k_direction[] = fillarray(i_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
        i_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
        i_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])

    xout sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y] \
        + k_direction[$Z] * k_direction[$Z])
endop


/**********************************************************************************************************************
 * AF_3D_Audio_SourceDistance
 **********************************************************************************************************************
 * Returns the distance and direction from the listener to the given source position.
 *
 * in  k[]: Source's position [x, y, z].
 *
 * out k  : Distance from listener to given source position.
 */
opcode AF_3D_Audio_SourceDistance, k, k[]
    k_sourcePosition[] xin

    k_direction[] = fillarray(k_sourcePosition[$X] - gk_AF_3D_ListenerPosition[$X],
        k_sourcePosition[$Y] - gk_AF_3D_ListenerPosition[$Y],
        k_sourcePosition[$Z] - gk_AF_3D_ListenerPosition[$Z])

    xout sqrt(k_direction[$X] * k_direction[$X] + k_direction[$Y] * k_direction[$Y] \
        + k_direction[$Z] * k_direction[$Z])
endop


/**********************************************************************************************************************
 * AF_3D_Audio_SourceDirection
 **********************************************************************************************************************
 * Returns the direction from the listener to the given source position.
 *
 * in  k[]: Source's position [x, y, z].
 *
 * out k[]: Normalized direction vector from listener to given source position.
 */
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


/**********************************************************************************************************************
 * AF_3D_Audio_DopplerShift
 **********************************************************************************************************************
 *
 * in  k  : The previous distance between the sound source and the listener.
 * in  k  : The current distance between the sound source and the listener.
 * in  k  : The time in seconds it took to move from the previous distance to the current distance.
 *
 * out k  : The amount of doppler shift calculated by comparing the given distance to the previously given distance.
 */
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
