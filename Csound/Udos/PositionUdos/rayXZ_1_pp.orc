
#include "time_PlaybackTime.orc"

/// Returns the X and Z coordinates of a ray moving into the (+,+) quadrant of the XZ plane.
/// Returns a constant Y of 0.
///
opcode dEd_rayXZ_1_pp, iii, 0
    iXZ init time_PlaybackTime:i()
    iY init 0

    xout iXZ, iY, iXZ
endop

/// Returns the X and Z coordinates of a ray moving into the (+,+) quadrant of the XZ plane.
/// Returns a constant Y of 0.
///
opcode dEd_rayXZ_1_pp, kkk, 0
    kXZ init 0
    kY init 0

    kI init 0
    kXZ = time_PlaybackTime:k()
    kI += 1

    xout kXZ, kY, kXZ
endop
