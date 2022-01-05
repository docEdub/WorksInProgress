
/// Returns a new randomized X and Z coordinate from -1 to 1 on every i-pass.
/// Returns a constant Y of 0.
///
opcode dEd_random_XZ, iii, 0
    iX init random(-1, 1)
    iY init 0
    iZ init random(-1, 1)
    xout iX, iY, iZ
endop

/// Returns a new randomized X and Z coordinate from -1 to 1 every 1/16th of a second.
/// Returns a constant Y of 0.
///
opcode dEd_random_XZ, kkk, 0
    kX init 0
    kY init 0
    kZ init 0

    kTick init 0
    kPreviousTick init 0
    kTick = gkPlaybackTimeInSeconds / 0.0625 // 1 tick = 1/16th of a second.
    if (kTick - kPreviousTick > 1 || kTick < kPreviousTick) then
        kPreviousTick = kTick
        kX = random:k(-1, 1)
        kZ = random:k(-1, 1)
    endif

    xout kX, kY, kZ
endop
