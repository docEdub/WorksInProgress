
#ifndef OUT_CHANNEL_COUNT
    #define OUT_CHANNEL_COUNT 2
#endif

ksmps = 64 // a.k.a. max tracks. N.B. this has to be a power of 2 for Reaper; otherwise mode 3 track samples get out of sync on aux tracks.
nchnls = OUT_CHANNEL_COUNT
0dbfs = 1
