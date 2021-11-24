
/// Returns a new randomized X and Z coordinate from -100 to 100 every 1/16th of a second.
/// Returns a constant Y of 2.
///
opcode AF_RandomPosition2, kkk, 0
    kX init 0
    kY init 2
    kZ init 0

    kTick init 0
    kPreviousTick init 0
    kTick = chnget:k("TIME_IN_SECONDS") / 0.0625 // 1 tick = 1/16th of a second.
    if (kTick - kPreviousTick > 1) then
        kPreviousTick = kTick
        kX = random(-100, 100)
        kZ = random(-100, 100)
    endif

    xout kX, kY, kZ
endop
