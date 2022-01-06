
#include "time_PlaybackTime.orc"

/// Returns the X and Z coordinates of a circle with a radius of 1 with a full rotation every 1 second.
/// Returns a constant Y of 0.
///
opcode dEd_circle_XZ, iii, 0
    iPeriod = 1

    iX init 0
    iY init 0
    iZ init 0

    iT = $AF_MATH__PI2 * (wrap(time_PlaybackTime:i(), 0, iPeriod) / iPeriod)
    iX = sin(iT)
    iZ = cos(iT)

    xout iX, iY, iZ
endop

/// Returns the X and Z coordinates of a circle with a radius of 1 with a full rotation every 1 second.
/// Returns a constant Y of 0.
///
opcode dEd_circle_XZ, kkk, 0
    iPeriod = 1

    kX init 0
    kY init 0
    kZ init 0

    kT = $AF_MATH__PI2 * (wrap(time_PlaybackTime:k(), 0, iPeriod) / iPeriod)
    kX = sin(kT)
    kZ = cos(kT)

    xout kX, kY, kZ
endop
