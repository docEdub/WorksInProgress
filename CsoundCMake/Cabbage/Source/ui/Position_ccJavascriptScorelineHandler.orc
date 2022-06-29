#include "definitions.h"

#if !IS_PLAYBACK
    instr CONCAT(PositionHandler_, INSTRUMENT_NAME)
        if (gi_oscHandle == -1) then
            // Restart this instrument to see if the OSC handle has been set, yet.
            log_i_trace("OSC not initialized. Restarting instrument in 1 second.")
            event("i", p1, 1, -1)
            turnoff
        else
            log_i_trace("Listening for position channel updates on port %d.", gi_oscPort)

            SPositionXOffset init "0"
            kReceived = OSClisten(
                gi_oscHandle,
                sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "Position/X/Offset"),
                "s",
                SPositionXOffset)
            if (kReceived == true) then
                kPositionXOffset = strtodk(SPositionXOffset)
                log_k_debug("Position/X/Offset = %.3f", kPositionXOffset)
                SScoreLine = sprintfk("i  \"%s\"    0 1 %d %d %.03f",  STRINGIZE(INSTRUMENT_NAME), EVENT_CC, CC_INDEX(positionXOffset), kPositionXOffset)
                scoreline(SScoreLine, 1)
                chnset(kPositionXOffset, $CC_CHANNEL_NAME(positionXOffset))
            endif

            SPositionYOffset init "0"
            kReceived = OSClisten(
                gi_oscHandle,
                sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "Position/Y/Offset"),
                "s",
                SPositionYOffset)
            if (kReceived == true) then
                kPositionYOffset = strtodk(SPositionYOffset)
                log_k_debug("Position/Y/Offset = %.3f", kPositionYOffset)
                SScoreLine = sprintfk("i  \"%s\"    0 1 %d %d %.03f",  STRINGIZE(INSTRUMENT_NAME), EVENT_CC, CC_INDEX(positionYOffset), kPositionYOffset)
                scoreline(SScoreLine, 1)
                chnset(kPositionYOffset, $CC_CHANNEL_NAME(positionYOffset))
            endif

            SPositionZOffset init "0"
            kReceived = OSClisten(
                gi_oscHandle,
                sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "Position/Z/Offset"),
                "s",
                SPositionZOffset)
            if (kReceived == true) then
                kPositionZOffset = strtodk(SPositionZOffset)
                log_k_debug("Position/Z/Offset = %.3f", kPositionZOffset)
                SScoreLine = sprintfk("i  \"%s\"    0 1 %d %d %.03f", STRINGIZE(INSTRUMENT_NAME), EVENT_CC, CC_INDEX(positionZOffset), kPositionZOffset)
                scoreline(SScoreLine, 1)
                chnset(kPositionZOffset, $CC_CHANNEL_NAME(positionZOffset))
            endif
        endif
    endin

    scoreline_i(sprintf("i \"PositionHandler_%s\" 0 -1", STRINGIZE(INSTRUMENT_NAME)))
#endif
