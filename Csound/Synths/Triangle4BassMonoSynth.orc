#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Triangle4BassMonoSynth.orc
//
// Description:
//  Single triangle wave oscillator with mono-synth pitch and note on/off handling.
//----------------------------------------------------------------------------------------------------------------------

#include "synth-before-include-guard.h.orc"

#ifndef ${InstrumentName}_orc__include_guard
#define ${InstrumentName}_orc__include_guard

#include "synth-inside-include-guard.h.orc"
#include "Common/TriangleMonoSynth.in-include-guard.orc"

giTriangle4BassMonoSynth_PlaybackVolumeAdjustment = 0.9
giTriangle4BassMonoSynth_PlaybackReverbAdjustment = 1.5

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

#include "Common/TriangleMonoSynth.init.orc"

${CSOUND_DEFINE} TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime # 0.05  #
${CSOUND_DEFINE} TriangleMonoSynth_NoteNumberLagTime                # 0.215 #
${CSOUND_DEFINE} TriangleMonoSynth_VcoBandwith                      # 0.075 #

#include "Common/TriangleMonoSynth.instr.orc"
