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

giTriangle3MonoSynth_VolumeEnvelopeAttackAndDecayTime = 0.01
giTriangle3MonoSynth_PlaybackVolumeAdjustment = 0.9
giTriangle3MonoSynth_PlaybackReverbAdjustment = 1.5

giTriangle3MonoSynth_VolumeEnvelopeSlope = giSecondsPerSample / giTriangle3MonoSynth_VolumeEnvelopeAttackAndDecayTime

giTriangle3MonoSynth_NoteIndex[] init ORC_INSTANCE_COUNT
gkTriangle3MonoSynth_NoteNumber[] init ORC_INSTANCE_COUNT

#endif // #ifndef ${InstrumentName}_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

#include "TriangleMonoSynth.h.orc"
