#include "definitions.h"

#ifdef IS_ONE_SHOT_MIDI_NOTE
    #ifndef MIDI_NOTE_DURATION
        #error One shot MIDI notes must define a duration.
    #endif
#else
    #define MIDI_NOTE_DURATION -1
#endif

//======================================================================================================================
// MIDI note processing instrument. Triggered by MIDI notes on all channels.
//======================================================================================================================

// Assign all MIDI channels to MIDI not processing instrument.
massign 0, CSOUND_MIDI_NOTE_PROCESSING_INSTRUMENT_NUMBER

// Disable MIDI program change messages.
// NB: The Apple Logic DAW sends MIDI program change messages on each MIDI track at startup. If they are not disabled,
// Csound will route MIDI messages to instruments other than the one set using 'massign'.
pgmassign 0, 0

gi_noteId init 0

instr CSOUND_MIDI_NOTE_PROCESSING_INSTRUMENT_NUMBER
    gi_noteId = wrap(gi_noteId + 1, 1, 1000)

    #ifndef IS_ONE_SHOT_MIDI_NOTE
        k_i init 0
        k_i += 1

        k_released = release()
        k_releaseDeltaTime init 1 / kr
        if (k_released == true) then
            if (k_i > 1) then
                k_releaseDeltaTime = 0
            endif
        endif
    #endif

    if (i(gk_mode) == 1) goto mode_1
    if (i(gk_mode) == 4) goto mode_4
    goto end

    mode_1:
        log_i_trace("instr %d, mode_1 ...", p1)
        log_i_debug("gi_noteId = %d", gi_noteId)

        i_instrument = nstrnum(STRINGIZE($INSTRUMENT_NAME)) + gi_noteId / 1000
        log_i_debug("i_instrument = %.6f", i_instrument)

        event_i("i", i_instrument, 0, MIDI_NOTE_DURATION, EVENT_NOTE_ON, notnum(), veloc())

        #ifndef IS_ONE_SHOT_MIDI_NOTE
            if (k_released == true) then
                event("i", -i_instrument, k_releaseDeltaTime, 0)
            endif
        #endif
        
        log_i_trace("instr %d, mode_1 - done", p1)
        goto end

    mode_4:
        log_i_trace("instr %d, mode_4 ...", p1)
        xtratim 2 / kr
        log_i_debug("gi_noteId = %d", gi_noteId)

        // Skip to end if track index is -1 due to mode switch lag.
        if (gk_trackIndex == -1) kgoto end

        k_noteOnSent init false
        if (k_noteOnSent == false) then
            sendScoreMessage_k(sprintfk("i  CONCAT(%s_%d, .%03d) %.03f %f EVENT_NOTE_ON Note(%d) Velocity(%d)",
                STRINGIZE($INSTRUMENT_NAME), gk_trackIndex, gi_noteId, elapsedTime_k(), MIDI_NOTE_DURATION, notnum(), veloc()))
            k_noteOnSent = true
        endif

        #ifndef IS_ONE_SHOT_MIDI_NOTE
            k_noteOffSent init false
            #if LOG_DEBUG
                if (changed(k_released) == true) then
                    log_k_debug("note %d, k_released = %d, k_noteOffSent = %d", gi_noteId, k_released, k_noteOffSent)
                endif
            #endif
            if (k_released == true && k_noteOffSent == false) then
                sendScoreMessage_k(sprintfk("i CONCAT(-%s_%d, .%03d) %.03f NoteOff", STRINGIZE($INSTRUMENT_NAME),
                    gk_trackIndex, gi_noteId, elapsedTime_k() + k_releaseDeltaTime))
                ; turnoff
                // N.B. The 'turnoff' opcode isn't working as expected here so a 'k_noteOffSent' flag is used to prevent
                // duplicate scorelines.
                k_noteOffSent = true
            endif
        #endif

        log_i_trace("instr %d, mode_4 - done", p1)
        goto end

    end:
endin
