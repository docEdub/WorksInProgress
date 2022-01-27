#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Triangle3MonoSynth.orc
//
// Description:
//  Single triangle wave oscillator with mono-synth pitch and note on/off handling.
//----------------------------------------------------------------------------------------------------------------------

#include "synth-before-include-guard.h.orc"

#ifndef ${InstrumentName}_orc__include_guard
#define ${InstrumentName}_orc__include_guard

#include "synth-inside-include-guard.h.orc"
#include "Common/TriangleMonoSynth.in-include-guard.orc"

giTriangle3MonoSynth_PlaybackVolumeAdjustment = 0.9
giTriangle3MonoSynth_PlaybackReverbAdjustment = 1.5

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

#include "Common/TriangleMonoSynth.init.orc"

${CSOUND_DEFINE} TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime # 0.05  #
${CSOUND_DEFINE} TriangleMonoSynth_NoteNumberPortamentoTime         # 0.025 #

#include "Common/TriangleMonoSynth.instr.orc"
