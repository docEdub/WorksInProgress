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
giTriangle4BassMonoSynth_HighPassCutoffFrequencyHz = 150
giTriangle4BassMonoSynth_LowPassCutoffFrequencyHz = 1000

opcode Triangle4BassMonoSynth_EffectChain, a, a
    a1 xin

    // Roll off lows with high pass filter.
    a1 = atone(a1, k(giTriangle4BassMonoSynth_HighPassCutoffFrequencyHz))

    // Roll off highs with low pass filter.
    a1 = tone(a1, k(giTriangle4BassMonoSynth_LowPassCutoffFrequencyHz))

    xout a1
endop

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

#include "Common/TriangleMonoSynth.init.orc"

${CSOUND_DEFINE} TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime # 0.05  #
${CSOUND_DEFINE} TriangleMonoSynth_NoteNumberLagTime                # 0.215 #
${CSOUND_DEFINE} TriangleMonoSynth_VcoBandwith                      # 0.075 #

${CSOUND_DEFINE} TriangleMonoSynth_EffectChain(aOut) # $aOut = Triangle4BassMonoSynth_EffectChain($aOut) #

#include "Common/TriangleMonoSynth.instr.orc"
#include "synth.instr.h.orc"
