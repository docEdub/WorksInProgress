#include "definitions.h"

#ifndef MIDI_NOTE_DURATION
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

    if (i(gk_mode) == 1) goto mode_1
    if (i(gk_mode) == 4) goto mode_4
    goto end

    mode_1:
        log_i_trace("instr 3, mode_1 ...")
        log_i_debug("gi_noteId = %d", gi_noteId)

        i_instrument = nstrnum(STRINGIZE($INSTRUMENT_NAME)) + gi_noteId / 1000
        log_i_debug("i_instrument = %.6f", i_instrument)

        event_i("i", i_instrument, 0, MIDI_NOTE_DURATION, EVENT_NOTE_ON, notnum(), veloc())
        log_i_trace("instr 3, mode_1 - done")
        goto end

    mode_4:
        log_i_trace("instr 3, mode_4 ...")
        xtratim 2 / kr
        log_i_debug("gi_noteId = %d", gi_noteId)

        // Skip to end if track index is -1 due to mode switch lag.
        if (gk_trackIndex == -1) kgoto end

        k_noteOnSent init false
        if (k_noteOnSent == false) then
            sendScoreMessage_k(sprintfk("i  CONCAT(%s_%d, .%03d) %.03f %.03f EVENT_NOTE_ON Note(%d) Velocity(%d)",
                STRINGIZE($INSTRUMENT_NAME), gk_trackIndex, gi_noteId, elapsedTime_k(), MIDI_NOTE_DURATION, notnum(), veloc()))
            k_noteOnSent = true
        endif
        log_i_trace("instr 3, mode_4 - done")
        goto end

    end:
endin
