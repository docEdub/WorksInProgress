#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: cabbage_core_global.orc
// 
// Csound globals used in Cabbage effect and synth plugins.
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "core_global.orc"
${CSOUND_INCLUDE} "time.orc"

gS_host = "undefined"
gS_os = "undefined"

gkPlaybackTimeInSeconds init 0
gk_dawPlayStartTime init 0
gk_isPlugin init false


opcode elapsedTime_i, i, 0
    xout time_i() - i(gk_dawPlayStartTime)
endop


opcode elapsedTime_k, k, 0
    xout time_k() - gk_dawPlayStartTime
endop


opcode sendScoreMessage_i, 0, S
    S_scoreMessage xin
    scoreline_i(sprintf("i \"SendScoreMessage\" 0 %f \"%s\"", 1 / kr, S_scoreMessage))
endop


opcode sendScoreMessage_k, 0, S
    S_scoreMessage xin
    log_k_debug("Sending score message %s", S_scoreMessage)
    scoreline(sprintfk("i \"SendScoreMessage\" 0 %f \"%s\"", 1 / kr, S_scoreMessage), 1)
endop


instr SendScoreMessage
    S_scoreMessage = strget(p4)
    OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_SCORE_GENERATION_PORT, DAW_SERVICE_OSC_SCORE_GENERATION_PATH,
        "s", S_scoreMessage)
    turnoff
endin


opcode sendTrackReferenceMessage_k, 0, kk
    k_trackIndex, k_trackRefIndex xin
    log_k_debug("Sending track reference message. Track index = %d. Track reference index = %d.", k_trackIndex,
        k_trackRefIndex)
    scoreline(sprintfk("i \"SendTrackReferenceMessage\" 0 %f %d %d", 1 / kr, k_trackIndex, k_trackRefIndex), 1)
endop


instr SendTrackReferenceMessage
    k_trackIndex = p4
    k_trackRefIndex = p5
    OSCsend(1, DAW_SERVICE_OSC_ADDRESS, DAW_SERVICE_OSC_SCORE_GENERATION_PORT, DAW_SERVICE_OSC_TRACK_REFERENCING_PATH,
        "ii", k_trackIndex, k_trackRefIndex)
    turnoff
endin

//----------------------------------------------------------------------------------------------------------------------
