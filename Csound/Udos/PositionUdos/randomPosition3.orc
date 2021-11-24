
/// Returns a new randomized X and Z coordinate from -100 to 100 on every i-pass.
/// Returns a constant Y of 3.
///
opcode dEd_randomPosition3, iii, 0
    iX init random(-100, 100)
    iY init 3
    iZ init random(-100, 100)
    xout iX, iY, iZ
endop

/// Returns a new randomized X and Z coordinate from -100 to 100 every 1/16th of a second.
/// Returns a constant Y of 3.
///
opcode dEd_randomPosition3, kkk, 0
    kX init 0
    kY init 3
    kZ init 0

    kTick init 0
    kPreviousTick init 0
    kTick = gkPlaybackTimeInSeconds / 0.0625 // 1 tick = 1/16th of a second.
    if (kTick - kPreviousTick > 1) then
        kPreviousTick = kTick
        kX = random(-100, 100)
        kZ = random(-100, 100)
    endif

    xout kX, kY, kZ
endop
