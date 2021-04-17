#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: SubtractiveSynth.orc
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef SubtractiveSynth_orc__include_guard
#define SubtractiveSynth_orc__include_guard
//----------------------------------------------------------------------------------------------------------------------
// This section is only included once in the playback .csd. It is shared by all instances of this instrument.
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "adsr_linsegr.udo.orc"

${CSOUND_DEFINE} Waveform_Saw    #0#
${CSOUND_DEFINE} Waveform_Square #1#
${CSOUND_DEFINE} Waveform_Pulse  #2#
${CSOUND_DEFINE} Waveform_Noise  #3#

${CSOUND_DEFINE} LfoShape_None            #0#
${CSOUND_DEFINE} LfoShape_Sine            #1#
${CSOUND_DEFINE} LfoShape_Triangles       #2#
${CSOUND_DEFINE} LfoShape_Square_Polar    #3#
${CSOUND_DEFINE} LfoShape_Square_Unipolar #4#
${CSOUND_DEFINE} LfoShape_SawTooth        #5#
${CSOUND_DEFINE} LfoShape_SawTooth_Down   #6#

${CSOUND_DEFINE} PositionType_Absolute #0#
${CSOUND_DEFINE} PositionType_Relative #1#


// TODO: Try using XMACROS here and in CreateCcIndexesInstrument to prevent having to keep the two in sync manually.
CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    "osc1Enabled",                              "bool",     "false",            "synced", _(\)
    "osc1Waveform",                             "number",   "$Waveform_Saw",    "synced", _(\)
_(\)
    "osc1PulseWidthEnabled",                    "bool",     "false",            "synced", _(\)
    "osc1PulseWidth",                           "number",   "0.5",              "synced", _(\)
    "osc1PulseWidthAdsrEnabled",                "bool",     "false",            "synced", _(\)
    "osc1PulseWidthAttack",                     "number",   "0",                "synced", _(\)
    "osc1PulseWidthDecay",                      "number",   "0",                "synced", _(\)
    "osc1PulseWidthSustain",                    "number",   "0",                "synced", _(\)
    "osc1PulseWidthRelease",                    "number",   "0",                "synced", _(\)
    "osc1PulseWidthLfoEnabled",                 "bool",     "false",            "synced", _(\)
    "osc1PulseWidthLfoShape",                   "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc1PulseWidthLfoAmplitude",               "number",   "0",                "synced", _(\)
    "osc1PulseWidthLfoFrequency",               "number",   "0",                "synced", _(\)
_(\)
    "osc1PitchEnabled",                         "bool",     "false",            "synced", _(\)
    "osc1Pitch",                                "number",   "0",                "synced", _(\)
    "osc1PitchAdsrEnabled",                     "bool",     "false",            "synced", _(\)
    "osc1PitchAttack",                          "number",   "0",                "synced", _(\)
    "osc1PitchDecay",                           "number",   "0",                "synced", _(\)
    "osc1PitchSustain",                         "number",   "0",                "synced", _(\)
    "osc1PitchRelease",                         "number",   "0",                "synced", _(\)
    "osc1PitchLfoEnabled",                      "bool",     "false",            "synced", _(\)
    "osc1PitchLfoShape",                        "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc1PitchLfoAmplitude",                    "number",   "0",                "synced", _(\)
    "osc1PitchLfoFrequency",                    "number",   "0",                "synced", _(\)
_(\)
    "osc1FilterCutoffFrequencyEnabled",         "bool",     "false",            "synced", _(\)
    "osc1FilterCutoffFrequency",                "number",   "20000",            "synced", _(\)
    "osc1FilterCutoffFrequencyAdsrEnabled",     "bool",     "false",            "synced", _(\)
    "osc1FilterCutoffFrequencyAttack",          "number",   "0",                "synced", _(\)
    "osc1FilterCutoffFrequencyDecay",           "number",   "0",                "synced", _(\)
    "osc1FilterCutoffFrequencySustain",         "number",   "0",                "synced", _(\)
    "osc1FilterCutoffFrequencyRelease",         "number",   "0",                "synced", _(\)
    "osc1FilterCutoffFrequencyLfoEnabled",      "bool",     "false",            "synced", _(\)
    "osc1FilterCutoffFrequencyLfoShape",        "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc1FilterCutoffFrequencyLfoAmplitude",    "number",   "0",                "synced", _(\)
    "osc1FilterCutoffFrequencyLfoFrequency",    "number",   "0",                "synced", _(\)
_(\)
    "osc1FilterResonanceEnabled",               "bool",     "false",            "synced", _(\)
    "osc1FilterResonance",                      "number",   "0",                "synced", _(\)
    "osc1FilterResonanceAdsrEnabled",           "bool",     "false",            "synced", _(\)
    "osc1FilterResonanceAttack",                "number",   "0",                "synced", _(\)
    "osc1FilterResonanceDecay",                 "number",   "0",                "synced", _(\)
    "osc1FilterResonanceSustain",               "number",   "0",                "synced", _(\)
    "osc1FilterResonanceRelease",               "number",   "0",                "synced", _(\)
    "osc1FilterResonanceLfoEnabled",            "bool",     "false",            "synced", _(\)
    "osc1FilterResonanceLfoShape",              "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc1FilterResonanceLfoAmplitude",          "number",   "0",                "synced", _(\)
    "osc1FilterResonanceLfoFrequency",          "number",   "0",                "synced", _(\)
    _(\)
    "osc1VolumeEnabled",                        "bool",     "false",            "synced", _(\)
    "osc1Volume",                               "number",   "1",                "synced", _(\)
    "osc1VolumeAdsrEnabled",                    "bool",     "false",            "synced", _(\)
    "osc1VolumeAttack",                         "number",   "0",                "synced", _(\)
    "osc1VolumeDecay",                          "number",   "0",                "synced", _(\)
    "osc1VolumeSustain",                        "number",   "0",                "synced", _(\)
    "osc1VolumeRelease",                        "number",   "0",                "synced", _(\)
    "osc1VolumeLfoEnabled",                     "bool",     "false",            "synced", _(\)
    "osc1VolumeLfoShape",                       "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc1VolumeLfoAmplitude",                   "number",   "0",                "synced", _(\)
    "osc1VolumeLfoFrequency",                   "number",   "0",                "synced", _(\)
_(\)
_(\)
_(\)
    "osc2Enabled",                              "bool",     "false",            "synced", _(\)
    "osc2Waveform",                             "number",   "$Waveform_Saw",    "synced", _(\)
_(\)
    "osc2PulseWidthEnabled",                    "bool",     "false",            "synced", _(\)
    "osc2PulseWidth",                           "number",   "0.5",              "synced", _(\)
    "osc2PulseWidthAdsrEnabled",                "bool",     "false",            "synced", _(\)
    "osc2PulseWidthAttack",                     "number",   "0",                "synced", _(\)
    "osc2PulseWidthDecay",                      "number",   "0",                "synced", _(\)
    "osc2PulseWidthSustain",                    "number",   "0",                "synced", _(\)
    "osc2PulseWidthRelease",                    "number",   "0",                "synced", _(\)
    "osc2PulseWidthLfoEnabled",                 "bool",     "false",            "synced", _(\)
    "osc2PulseWidthLfoShape",                   "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc2PulseWidthLfoAmplitude",               "number",   "0",                "synced", _(\)
    "osc2PulseWidthLfoFrequency",               "number",   "0",                "synced", _(\)
_(\)
    "osc2PitchEnabled",                         "bool",     "false",            "synced", _(\)
    "osc2Pitch",                                "number",   "0",                "synced", _(\)
    "osc2PitchAdsrEnabled",                     "bool",     "false",            "synced", _(\)
    "osc2PitchAttack",                          "number",   "0",                "synced", _(\)
    "osc2PitchDecay",                           "number",   "0",                "synced", _(\)
    "osc2PitchSustain",                         "number",   "0",                "synced", _(\)
    "osc2PitchRelease",                         "number",   "0",                "synced", _(\)
    "osc2PitchLfoEnabled",                      "bool",     "false",            "synced", _(\)
    "osc2PitchLfoShape",                        "number",   "1",                "synced", _(\)
    "osc2PitchLfoAmplitude",                    "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc2PitchLfoFrequency",                    "number",   "0",                "synced", _(\)
_(\)
    "osc2FilterCutoffFrequencyEnabled",         "bool",     "false",            "synced", _(\)
    "osc2FilterCutoffFrequency",                "number",   "20000",            "synced", _(\)
    "osc2FilterCutoffFrequencyAdsrEnabled",     "bool",     "false",            "synced", _(\)
    "osc2FilterCutoffFrequencyAttack",          "number",   "0",                "synced", _(\)
    "osc2FilterCutoffFrequencyDecay",           "number",   "0",                "synced", _(\)
    "osc2FilterCutoffFrequencySustain",         "number",   "0",                "synced", _(\)
    "osc2FilterCutoffFrequencyRelease",         "number",   "0",                "synced", _(\)
    "osc2FilterCutoffFrequencyLfoEnabled",      "bool",     "false",            "synced", _(\)
    "osc2FilterCutoffFrequencyLfoShape",        "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc2FilterCutoffFrequencyLfoAmplitude",    "number",   "0",                "synced", _(\)
    "osc2FilterCutoffFrequencyLfoFrequency",    "number",   "0",                "synced", _(\)
_(\)
    "osc2FilterResonanceEnabled",               "bool",     "false",            "synced", _(\)
    "osc2FilterResonance",                      "number",   "0",                "synced", _(\)
    "osc2FilterResonanceAdsrEnabled",           "bool",     "false",            "synced", _(\)
    "osc2FilterResonanceAttack",                "number",   "0",                "synced", _(\)
    "osc2FilterResonanceDecay",                 "number",   "0",                "synced", _(\)
    "osc2FilterResonanceSustain",               "number",   "0",                "synced", _(\)
    "osc2FilterResonanceRelease",               "number",   "0",                "synced", _(\)
    "osc2FilterResonanceLfoEnabled",            "bool",     "false",            "synced", _(\)
    "osc2FilterResonanceLfoShape",              "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc2FilterResonanceLfoAmplitude",          "number",   "0",                "synced", _(\)
    "osc2FilterResonanceLfoFrequency",          "number",   "0",                "synced", _(\)
_(\)
    "osc2VolumeEnabled",                        "bool",     "false",            "synced", _(\)
    "osc2Volume",                               "number",   "1",                "synced", _(\)
    "osc2VolumeAdsrEnabled",                    "bool",     "false",            "synced", _(\)
    "osc2VolumeAttack",                         "number",   "0",                "synced", _(\)
    "osc2VolumeDecay",                          "number",   "0",                "synced", _(\)
    "osc2VolumeSustain",                        "number",   "0",                "synced", _(\)
    "osc2VolumeRelease",                        "number",   "0",                "synced", _(\)
    "osc2VolumeLfoEnabled",                     "bool",     "false",            "synced", _(\)
    "osc2VolumeLfoShape",                       "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc2VolumeLfoAmplitude",                   "number",   "0",                "synced", _(\)
    "osc2VolumeLfoFrequency",                   "number",   "0",                "synced", _(\)
_(\)
_(\)
_(\)
    "osc3Enabled",                              "bool",     "false",            "synced", _(\)
    "osc3Waveform",                             "number",   "$Waveform_Saw",    "synced", _(\)
_(\)
    "osc3PulseWidthEnabled",                    "bool",     "false",            "synced", _(\)
    "osc3PulseWidth",                           "number",   "0.5",              "synced", _(\)
    "osc3PulseWidthAdsrEnabled",                "bool",     "false",            "synced", _(\)
    "osc3PulseWidthAttack",                     "number",   "0",                "synced", _(\)
    "osc3PulseWidthDecay",                      "number",   "0",                "synced", _(\)
    "osc3PulseWidthSustain",                    "number",   "0",                "synced", _(\)
    "osc3PulseWidthRelease",                    "number",   "0",                "synced", _(\)
    "osc3PulseWidthLfoEnabled",                 "bool",     "false",            "synced", _(\)
    "osc3PulseWidthLfoShape",                   "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc3PulseWidthLfoAmplitude",               "number",   "0",                "synced", _(\)
    "osc3PulseWidthLfoFrequency",               "number",   "0",                "synced", _(\)
_(\)
    "osc3PitchEnabled",                         "bool",     "false",            "synced", _(\)
    "osc3Pitch",                                "number",   "0",                "synced", _(\)
    "osc3PitchAdsrEnabled",                     "bool",     "false",            "synced", _(\)
    "osc3PitchAttack",                          "number",   "0",                "synced", _(\)
    "osc3PitchDecay",                           "number",   "0",                "synced", _(\)
    "osc3PitchSustain",                         "number",   "0",                "synced", _(\)
    "osc3PitchRelease",                         "number",   "0",                "synced", _(\)
    "osc3PitchLfoEnabled",                      "bool",     "false",            "synced", _(\)
    "osc3PitchLfoShape",                        "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc3PitchLfoAmplitude",                    "number",   "0",                "synced", _(\)
    "osc3PitchLfoFrequency",                    "number",   "0",                "synced", _(\)
_(\)
    "osc3FilterCutoffFrequencyEnabled",         "bool",     "false",            "synced", _(\)
    "osc3FilterCutoffFrequency",                "number",   "20000",            "synced", _(\)
    "osc3FilterCutoffFrequencyAdsrEnabled",     "bool",     "false",            "synced", _(\)
    "osc3FilterCutoffFrequencyAttack",          "number",   "0",                "synced", _(\)
    "osc3FilterCutoffFrequencyDecay",           "number",   "0",                "synced", _(\)
    "osc3FilterCutoffFrequencySustain",         "number",   "0",                "synced", _(\)
    "osc3FilterCutoffFrequencyRelease",         "number",   "0",                "synced", _(\)
    "osc3FilterCutoffFrequencyLfoEnabled",      "bool",     "false",            "synced", _(\)
    "osc3FilterCutoffFrequencyLfoShape",        "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc3FilterCutoffFrequencyLfoAmplitude",    "number",   "0",                "synced", _(\)
    "osc3FilterCutoffFrequencyLfoFrequency",    "number",   "0",                "synced", _(\)
_(\)
    "osc3FilterResonanceEnabled",               "bool",     "false",            "synced", _(\)
    "osc3FilterResonance",                      "number",   "0",                "synced", _(\)
    "osc3FilterResonanceAdsrEnabled",           "bool",     "false",            "synced", _(\)
    "osc3FilterResonanceAttack",                "number",   "0",                "synced", _(\)
    "osc3FilterResonanceDecay",                 "number",   "0",                "synced", _(\)
    "osc3FilterResonanceSustain",               "number",   "0",                "synced", _(\)
    "osc3FilterResonanceRelease",               "number",   "0",                "synced", _(\)
    "osc3FilterResonanceLfoEnabled",            "bool",     "false",            "synced", _(\)
    "osc3FilterResonanceLfoShape",              "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc3FilterResonanceLfoAmplitude",          "number",   "0",                "synced", _(\)
    "osc3FilterResonanceLfoFrequency",          "number",   "0",                "synced", _(\)
_(\)
    "osc3VolumeEnabled",                        "bool",     "false",            "synced", _(\)
    "osc3Volume",                               "number",   "1",                "synced", _(\)
    "osc3VolumeAdsrEnabled",                    "bool",     "false",            "synced", _(\)
    "osc3VolumeAttack",                         "number",   "0",                "synced", _(\)
    "osc3VolumeDecay",                          "number",   "0",                "synced", _(\)
    "osc3VolumeSustain",                        "number",   "0",                "synced", _(\)
    "osc3VolumeRelease",                        "number",   "0",                "synced", _(\)
    "osc3VolumeLfoEnabled",                     "bool",     "false",            "synced", _(\)
    "osc3VolumeLfoShape",                       "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc3VolumeLfoAmplitude",                   "number",   "0",                "synced", _(\)
    "osc3VolumeLfoFrequency",                   "number",   "0",                "synced", _(\)
_(\)
_(\)
_(\)
    "osc4Enabled",                              "bool",     "false",            "synced", _(\)
    "osc4Waveform",                             "number",   "$Waveform_Saw",    "synced", _(\)
_(\)
    "osc4PulseWidthEnabled",                    "bool",     "false",            "synced", _(\)
    "osc4PulseWidth",                           "number",   "0.5",              "synced", _(\)
    "osc4PulseWidthAdsrEnabled",                "bool",     "false",            "synced", _(\)
    "osc4PulseWidthAttack",                     "number",   "0",                "synced", _(\)
    "osc4PulseWidthDecay",                      "number",   "0",                "synced", _(\)
    "osc4PulseWidthSustain",                    "number",   "0",                "synced", _(\)
    "osc4PulseWidthRelease",                    "number",   "0",                "synced", _(\)
    "osc4PulseWidthLfoEnabled",                 "bool",     "false",            "synced", _(\)
    "osc4PulseWidthLfoShape",                   "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc4PulseWidthLfoAmplitude",               "number",   "0",                "synced", _(\)
    "osc4PulseWidthLfoFrequency",               "number",   "0",                "synced", _(\)
_(\)
    "osc4PitchEnabled",                         "bool",     "false",            "synced", _(\)
    "osc4Pitch",                                "number",   "0",                "synced", _(\)
    "osc4PitchAdsrEnabled",                     "bool",     "false",            "synced", _(\)
    "osc4PitchAttack",                          "number",   "0",                "synced", _(\)
    "osc4PitchDecay",                           "number",   "0",                "synced", _(\)
    "osc4PitchSustain",                         "number",   "0",                "synced", _(\)
    "osc4PitchRelease",                         "number",   "0",                "synced", _(\)
    "osc4PitchLfoEnabled",                      "bool",     "false",            "synced", _(\)
    "osc4PitchLfoShape",                        "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc4PitchLfoAmplitude",                    "number",   "0",                "synced", _(\)
    "osc4PitchLfoFrequency",                    "number",   "0",                "synced", _(\)
_(\)
    "osc4FilterCutoffFrequencyEnabled",         "bool",     "false",            "synced", _(\)
    "osc4FilterCutoffFrequency",                "number",   "20000",            "synced", _(\)
    "osc4FilterCutoffFrequencyAdsrEnabled",     "bool",     "false",            "synced", _(\)
    "osc4FilterCutoffFrequencyAttack",          "number",   "0",                "synced", _(\)
    "osc4FilterCutoffFrequencyDecay",           "number",   "0",                "synced", _(\)
    "osc4FilterCutoffFrequencySustain",         "number",   "0",                "synced", _(\)
    "osc4FilterCutoffFrequencyRelease",         "number",   "0",                "synced", _(\)
    "osc4FilterCutoffFrequencyLfoEnabled",      "bool",     "false",            "synced", _(\)
    "osc4FilterCutoffFrequencyLfoShape",        "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc4FilterCutoffFrequencyLfoAmplitude",    "number",   "0",                "synced", _(\)
    "osc4FilterCutoffFrequencyLfoFrequency",    "number",   "0",                "synced", _(\)
_(\)
    "osc4FilterResonanceEnabled",               "bool",     "false",            "synced", _(\)
    "osc4FilterResonance",                      "number",   "0",                "synced", _(\)
    "osc4FilterResonanceAdsrEnabled",           "bool",     "false",            "synced", _(\)
    "osc4FilterResonanceAttack",                "number",   "0",                "synced", _(\)
    "osc4FilterResonanceDecay",                 "number",   "0",                "synced", _(\)
    "osc4FilterResonanceSustain",               "number",   "0",                "synced", _(\)
    "osc4FilterResonanceRelease",               "number",   "0",                "synced", _(\)
    "osc4FilterResonanceLfoEnabled",            "bool",     "false",            "synced", _(\)
    "osc4FilterResonanceLfoShape",              "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc4FilterResonanceLfoAmplitude",          "number",   "0",                "synced", _(\)
    "osc4FilterResonanceLfoFrequency",          "number",   "0",                "synced", _(\)
_(\)
    "osc4VolumeEnabled",                        "bool",     "false",            "synced", _(\)
    "osc4Volume",                               "number",   "1",                "synced", _(\)
    "osc4VolumeAdsrEnabled",                    "bool",     "false",            "synced", _(\)
    "osc4VolumeAttack",                         "number",   "0",                "synced", _(\)
    "osc4VolumeDecay",                          "number",   "0",                "synced", _(\)
    "osc4VolumeSustain",                        "number",   "0",                "synced", _(\)
    "osc4VolumeRelease",                        "number",   "0",                "synced", _(\)
    "osc4VolumeLfoEnabled",                     "bool",     "false",            "synced", _(\)
    "osc4VolumeLfoShape",                       "number",   "$LfoShape_Sine",   "synced", _(\)
    "osc4VolumeLfoAmplitude",                   "number",   "0",                "synced", _(\)
    "osc4VolumeLfoFrequency",                   "number",   "0",                "synced", _(\)
_(\)
_(\)
_(\)
    "filterEnabled",                            "bool",     "false",            "synced", _(\)
_(\)
    "filterCutoffFrequencyEnabled",             "bool",     "false",            "synced", _(\)
    "filterCutoffFrequency",                    "number",   "20000",            "synced", _(\)
    "filterCutoffFrequencyAdsrEnabled",         "bool",     "false",            "synced", _(\)
    "filterCutoffFrequencyAttack",              "number",   "0",                "synced", _(\)
    "filterCutoffFrequencyDecay",               "number",   "0",                "synced", _(\)
    "filterCutoffFrequencySustain",             "number",   "0",                "synced", _(\)
    "filterCutoffFrequencyRelease",             "number",   "0",                "synced", _(\)
_(\)
    "filterResonanceEnabled",                   "bool",     "false",            "synced", _(\)
    "filterResonance",                          "number",   "0",                "synced", _(\)
    "filterResonanceAdsrEnabled",               "bool",     "false",            "synced", _(\)
    "filterResonanceAttack",                    "number",   "0",                "synced", _(\)
    "filterResonanceDecay",                     "number",   "0",                "synced", _(\)
    "filterResonanceSustain",                   "number",   "0",                "synced", _(\)
    "filterResonanceRelease",                   "number",   "0",                "synced", _(\)
_(\)
_(\)
_(\)
    "amplitudeEnabled",                         "bool",     "false",            "synced", _(\)
_(\)
    "amplitudeAttack",                          "number",   "0.1",              "synced", _(\)
    "amplitudeDecay",                           "number",   "0.1",              "synced", _(\)
    "amplitudeSustain",                         "number",   "0.5",              "synced", _(\)
    "amplitudeRelease",                         "number",   "0.1",              "synced", _(\)
_(\)
_(\)
_(\)
    "positionEnabled",                          "bool",     "false",            "synced", _(\)
_(\)
    "positionDistanceType",                     "number",   "0",                "synced", _(\)
    "positionDirectionType",                    "number",   "0",                "synced", _(\)
_(\)
    "positionXYZEnabled",                       "bool",     "false",            "synced", _(\)
    "positionX",                                "number",   "0",                "synced", _(\)
    "positionY",                                "number",   "0",                "synced", _(\)
    "positionCartesianZ",                       "number",   "0",                "synced", _(\)
    "positionMaxXYZ",                           "number",   "100",              "synced", _(\)
_(\)
    "positionRTZEnabled",                       "bool",     "false",            "synced", _(\)
    "positionR",                                "number",   "0",                "synced", _(\)
    "positionT",                                "number",   "0",                "synced", _(\)
    "positionPolarZ",                           "number",   "0",                "synced", _(\)
    "positionMaxRZ",                            "number",   "100",              "synced", _(\)
_(\)
    "calculatedPositionX",                      "number",   "0",                "static", _(\)
    "calculatedPositionY",                      "number",   "0",                "static", _(\)
    "calculatedPositionZ",                      "number",   "0",                "static", _(\)
    "calculatedDistance",                       "number",   "100",              "static", _(\)
    "calculatedDistanceAttenuation",            "number",   "1",                "static", _(\)
    "calculatedDopplerShift",                   "number",   "1",                "static", _(\)
_(\)
    "",                                         "",         "",                 "") // dummy line

    ; "timeOfLastPositionCalculation",            "number",   "0",                "static", _(\)

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    // -----------------------------------------------------------------------------------------------------------------
    // Oscillator 1 tab
    // -----------------------------------------------------------------------------------------------------------------
    CREATE_CC_INDEX(osc1Enabled)
    CREATE_CC_INDEX(osc1Waveform)

    CREATE_CC_INDEX(osc1PulseWidthEnabled)
    CREATE_CC_INDEX(osc1PulseWidth)
    CREATE_CC_INDEX(osc1PulseWidthAdsrEnabled)
    CREATE_CC_INDEX(osc1PulseWidthAttack)
    CREATE_CC_INDEX(osc1PulseWidthDecay)
    CREATE_CC_INDEX(osc1PulseWidthSustain)
    CREATE_CC_INDEX(osc1PulseWidthRelease)
    CREATE_CC_INDEX(osc1PulseWidthLfoEnabled)
    CREATE_CC_INDEX(osc1PulseWidthLfoShape)
    CREATE_CC_INDEX(osc1PulseWidthLfoAmplitude)
    CREATE_CC_INDEX(osc1PulseWidthLfoFrequency)

    CREATE_CC_INDEX(osc1PitchEnabled)
    CREATE_CC_INDEX(osc1Pitch)
    CREATE_CC_INDEX(osc1PitchAdsrEnabled)
    CREATE_CC_INDEX(osc1PitchAttack)
    CREATE_CC_INDEX(osc1PitchDecay)
    CREATE_CC_INDEX(osc1PitchSustain)
    CREATE_CC_INDEX(osc1PitchRelease)
    CREATE_CC_INDEX(osc1PitchLfoEnabled)
    CREATE_CC_INDEX(osc1PitchLfoShape)
    CREATE_CC_INDEX(osc1PitchLfoAmplitude)
    CREATE_CC_INDEX(osc1PitchLfoFrequency)

    CREATE_CC_INDEX(osc1FilterCutoffFrequencyEnabled)
    CREATE_CC_INDEX(osc1FilterCutoffFrequency)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencyAdsrEnabled)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencyAttack)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencyDecay)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencySustain)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencyRelease)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencyLfoEnabled)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencyLfoShape)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencyLfoAmplitude)
    CREATE_CC_INDEX(osc1FilterCutoffFrequencyLfoFrequency)

    CREATE_CC_INDEX(osc1FilterResonanceEnabled)
    CREATE_CC_INDEX(osc1FilterResonance)
    CREATE_CC_INDEX(osc1FilterResonanceAdsrEnabled)
    CREATE_CC_INDEX(osc1FilterResonanceAttack)
    CREATE_CC_INDEX(osc1FilterResonanceDecay)
    CREATE_CC_INDEX(osc1FilterResonanceSustain)
    CREATE_CC_INDEX(osc1FilterResonanceRelease)
    CREATE_CC_INDEX(osc1FilterResonanceEnabled)
    CREATE_CC_INDEX(osc1FilterResonanceLfoEnabled)
    CREATE_CC_INDEX(osc1FilterResonanceLfoShape)
    CREATE_CC_INDEX(osc1FilterResonanceLfoAmplitude)
    CREATE_CC_INDEX(osc1FilterResonanceLfoFrequency)

    CREATE_CC_INDEX(osc1VolumeEnabled)
    CREATE_CC_INDEX(osc1Volume)
    CREATE_CC_INDEX(osc1VolumeAdsrEnabled)
    CREATE_CC_INDEX(osc1VolumeAttack)
    CREATE_CC_INDEX(osc1VolumeDecay)
    CREATE_CC_INDEX(osc1VolumeSustain)
    CREATE_CC_INDEX(osc1VolumeRelease)
    CREATE_CC_INDEX(osc1VolumeLfoEnabled)
    CREATE_CC_INDEX(osc1VolumeLfoShape)
    CREATE_CC_INDEX(osc1VolumeLfoAmplitude)
    CREATE_CC_INDEX(osc1VolumeLfoFrequency)

    // -----------------------------------------------------------------------------------------------------------------
    // Oscillator 2 tab
    // -----------------------------------------------------------------------------------------------------------------
    CREATE_CC_INDEX(osc2Enabled)
    CREATE_CC_INDEX(osc2Waveform)

    CREATE_CC_INDEX(osc2PulseWidthEnabled)
    CREATE_CC_INDEX(osc2PulseWidth)
    CREATE_CC_INDEX(osc2PulseWidthAdsrEnabled)
    CREATE_CC_INDEX(osc2PulseWidthAttack)
    CREATE_CC_INDEX(osc2PulseWidthDecay)
    CREATE_CC_INDEX(osc2PulseWidthSustain)
    CREATE_CC_INDEX(osc2PulseWidthRelease)
    CREATE_CC_INDEX(osc2PulseWidthLfoEnabled)
    CREATE_CC_INDEX(osc2PulseWidthLfoShape)
    CREATE_CC_INDEX(osc2PulseWidthLfoAmplitude)
    CREATE_CC_INDEX(osc2PulseWidthLfoFrequency)

    CREATE_CC_INDEX(osc2PitchEnabled)
    CREATE_CC_INDEX(osc2Pitch)
    CREATE_CC_INDEX(osc2PitchAdsrEnabled)
    CREATE_CC_INDEX(osc2PitchAttack)
    CREATE_CC_INDEX(osc2PitchDecay)
    CREATE_CC_INDEX(osc2PitchSustain)
    CREATE_CC_INDEX(osc2PitchRelease)
    CREATE_CC_INDEX(osc2PitchLfoEnabled)
    CREATE_CC_INDEX(osc2PitchLfoShape)
    CREATE_CC_INDEX(osc2PitchLfoAmplitude)
    CREATE_CC_INDEX(osc2PitchLfoFrequency)

    CREATE_CC_INDEX(osc2FilterCutoffFrequencyEnabled)
    CREATE_CC_INDEX(osc2FilterCutoffFrequency)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencyAdsrEnabled)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencyAttack)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencyDecay)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencySustain)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencyRelease)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencyLfoEnabled)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencyLfoShape)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencyLfoAmplitude)
    CREATE_CC_INDEX(osc2FilterCutoffFrequencyLfoFrequency)

    CREATE_CC_INDEX(osc2FilterResonanceEnabled)
    CREATE_CC_INDEX(osc2FilterResonance)
    CREATE_CC_INDEX(osc2FilterResonanceAdsrEnabled)
    CREATE_CC_INDEX(osc2FilterResonanceAttack)
    CREATE_CC_INDEX(osc2FilterResonanceDecay)
    CREATE_CC_INDEX(osc2FilterResonanceSustain)
    CREATE_CC_INDEX(osc2FilterResonanceRelease)
    CREATE_CC_INDEX(osc2FilterResonanceEnabled)
    CREATE_CC_INDEX(osc2FilterResonanceLfoEnabled)
    CREATE_CC_INDEX(osc2FilterResonanceLfoShape)
    CREATE_CC_INDEX(osc2FilterResonanceLfoAmplitude)
    CREATE_CC_INDEX(osc2FilterResonanceLfoFrequency)

    CREATE_CC_INDEX(osc2VolumeEnabled)
    CREATE_CC_INDEX(osc2Volume)
    CREATE_CC_INDEX(osc2VolumeAdsrEnabled)
    CREATE_CC_INDEX(osc2VolumeAttack)
    CREATE_CC_INDEX(osc2VolumeDecay)
    CREATE_CC_INDEX(osc2VolumeSustain)
    CREATE_CC_INDEX(osc2VolumeRelease)
    CREATE_CC_INDEX(osc2VolumeLfoEnabled)
    CREATE_CC_INDEX(osc2VolumeLfoShape)
    CREATE_CC_INDEX(osc2VolumeLfoAmplitude)
    CREATE_CC_INDEX(osc2VolumeLfoFrequency)

    // -----------------------------------------------------------------------------------------------------------------
    // Oscillator 3 tab
    // -----------------------------------------------------------------------------------------------------------------
    CREATE_CC_INDEX(osc3Enabled)
    CREATE_CC_INDEX(osc3Waveform)

    CREATE_CC_INDEX(osc3PulseWidthEnabled)
    CREATE_CC_INDEX(osc3PulseWidth)
    CREATE_CC_INDEX(osc3PulseWidthAdsrEnabled)
    CREATE_CC_INDEX(osc3PulseWidthAttack)
    CREATE_CC_INDEX(osc3PulseWidthDecay)
    CREATE_CC_INDEX(osc3PulseWidthSustain)
    CREATE_CC_INDEX(osc3PulseWidthRelease)
    CREATE_CC_INDEX(osc3PulseWidthLfoEnabled)
    CREATE_CC_INDEX(osc3PulseWidthLfoShape)
    CREATE_CC_INDEX(osc3PulseWidthLfoAmplitude)
    CREATE_CC_INDEX(osc3PulseWidthLfoFrequency)

    CREATE_CC_INDEX(osc3PitchEnabled)
    CREATE_CC_INDEX(osc3Pitch)
    CREATE_CC_INDEX(osc3PitchAdsrEnabled)
    CREATE_CC_INDEX(osc3PitchAttack)
    CREATE_CC_INDEX(osc3PitchDecay)
    CREATE_CC_INDEX(osc3PitchSustain)
    CREATE_CC_INDEX(osc3PitchRelease)
    CREATE_CC_INDEX(osc3PitchLfoEnabled)
    CREATE_CC_INDEX(osc3PitchLfoShape)
    CREATE_CC_INDEX(osc3PitchLfoAmplitude)
    CREATE_CC_INDEX(osc3PitchLfoFrequency)

    CREATE_CC_INDEX(osc3FilterCutoffFrequencyEnabled)
    CREATE_CC_INDEX(osc3FilterCutoffFrequency)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencyAdsrEnabled)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencyAttack)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencyDecay)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencySustain)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencyRelease)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencyLfoEnabled)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencyLfoShape)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencyLfoAmplitude)
    CREATE_CC_INDEX(osc3FilterCutoffFrequencyLfoFrequency)

    CREATE_CC_INDEX(osc3FilterResonanceEnabled)
    CREATE_CC_INDEX(osc3FilterResonance)
    CREATE_CC_INDEX(osc3FilterResonanceAdsrEnabled)
    CREATE_CC_INDEX(osc3FilterResonanceAttack)
    CREATE_CC_INDEX(osc3FilterResonanceDecay)
    CREATE_CC_INDEX(osc3FilterResonanceSustain)
    CREATE_CC_INDEX(osc3FilterResonanceRelease)
    CREATE_CC_INDEX(osc3FilterResonanceEnabled)
    CREATE_CC_INDEX(osc3FilterResonanceLfoEnabled)
    CREATE_CC_INDEX(osc3FilterResonanceLfoShape)
    CREATE_CC_INDEX(osc3FilterResonanceLfoAmplitude)
    CREATE_CC_INDEX(osc3FilterResonanceLfoFrequency)

    CREATE_CC_INDEX(osc3VolumeEnabled)
    CREATE_CC_INDEX(osc3Volume)
    CREATE_CC_INDEX(osc3VolumeAdsrEnabled)
    CREATE_CC_INDEX(osc3VolumeAttack)
    CREATE_CC_INDEX(osc3VolumeDecay)
    CREATE_CC_INDEX(osc3VolumeSustain)
    CREATE_CC_INDEX(osc3VolumeRelease)
    CREATE_CC_INDEX(osc3VolumeLfoEnabled)
    CREATE_CC_INDEX(osc3VolumeLfoShape)
    CREATE_CC_INDEX(osc3VolumeLfoAmplitude)
    CREATE_CC_INDEX(osc3VolumeLfoFrequency)

    // -----------------------------------------------------------------------------------------------------------------
    // Oscillator 4 tab
    // -----------------------------------------------------------------------------------------------------------------
    CREATE_CC_INDEX(osc4Enabled)
    CREATE_CC_INDEX(osc4Waveform)

    CREATE_CC_INDEX(osc4PulseWidthEnabled)
    CREATE_CC_INDEX(osc4PulseWidth)
    CREATE_CC_INDEX(osc4PulseWidthAdsrEnabled)
    CREATE_CC_INDEX(osc4PulseWidthAttack)
    CREATE_CC_INDEX(osc4PulseWidthDecay)
    CREATE_CC_INDEX(osc4PulseWidthSustain)
    CREATE_CC_INDEX(osc4PulseWidthRelease)
    CREATE_CC_INDEX(osc4PulseWidthLfoEnabled)
    CREATE_CC_INDEX(osc4PulseWidthLfoShape)
    CREATE_CC_INDEX(osc4PulseWidthLfoAmplitude)
    CREATE_CC_INDEX(osc4PulseWidthLfoFrequency)

    CREATE_CC_INDEX(osc4PitchEnabled)
    CREATE_CC_INDEX(osc4Pitch)
    CREATE_CC_INDEX(osc4PitchAdsrEnabled)
    CREATE_CC_INDEX(osc4PitchAttack)
    CREATE_CC_INDEX(osc4PitchDecay)
    CREATE_CC_INDEX(osc4PitchSustain)
    CREATE_CC_INDEX(osc4PitchRelease)
    CREATE_CC_INDEX(osc4PitchLfoEnabled)
    CREATE_CC_INDEX(osc4PitchLfoShape)
    CREATE_CC_INDEX(osc4PitchLfoAmplitude)
    CREATE_CC_INDEX(osc4PitchLfoFrequency)

    CREATE_CC_INDEX(osc4FilterCutoffFrequencyEnabled)
    CREATE_CC_INDEX(osc4FilterCutoffFrequency)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencyAdsrEnabled)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencyAttack)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencyDecay)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencySustain)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencyRelease)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencyLfoEnabled)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencyLfoShape)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencyLfoAmplitude)
    CREATE_CC_INDEX(osc4FilterCutoffFrequencyLfoFrequency)

    CREATE_CC_INDEX(osc4FilterResonanceEnabled)
    CREATE_CC_INDEX(osc4FilterResonance)
    CREATE_CC_INDEX(osc4FilterResonanceAdsrEnabled)
    CREATE_CC_INDEX(osc4FilterResonanceAttack)
    CREATE_CC_INDEX(osc4FilterResonanceDecay)
    CREATE_CC_INDEX(osc4FilterResonanceSustain)
    CREATE_CC_INDEX(osc4FilterResonanceRelease)
    CREATE_CC_INDEX(osc4FilterResonanceEnabled)
    CREATE_CC_INDEX(osc4FilterResonanceLfoEnabled)
    CREATE_CC_INDEX(osc4FilterResonanceLfoShape)
    CREATE_CC_INDEX(osc4FilterResonanceLfoAmplitude)
    CREATE_CC_INDEX(osc4FilterResonanceLfoFrequency)

    CREATE_CC_INDEX(osc4VolumeEnabled)
    CREATE_CC_INDEX(osc4Volume)
    CREATE_CC_INDEX(osc4VolumeAdsrEnabled)
    CREATE_CC_INDEX(osc4VolumeAttack)
    CREATE_CC_INDEX(osc4VolumeDecay)
    CREATE_CC_INDEX(osc4VolumeSustain)
    CREATE_CC_INDEX(osc4VolumeRelease)
    CREATE_CC_INDEX(osc4VolumeLfoEnabled)
    CREATE_CC_INDEX(osc4VolumeLfoShape)
    CREATE_CC_INDEX(osc4VolumeLfoAmplitude)
    CREATE_CC_INDEX(osc4VolumeLfoFrequency)

    // -----------------------------------------------------------------------------------------------------------------
    // Filter tab
    // -----------------------------------------------------------------------------------------------------------------
    CREATE_CC_INDEX(filterEnabled)

    CREATE_CC_INDEX(filterCutoffFrequencyEnabled)
    CREATE_CC_INDEX(filterCutoffFrequency)
    CREATE_CC_INDEX(filterCutoffFrequencyAdsrEnabled)
    CREATE_CC_INDEX(filterCutoffFrequencyAttack)
    CREATE_CC_INDEX(filterCutoffFrequencyDecay)
    CREATE_CC_INDEX(filterCutoffFrequencySustain)
    CREATE_CC_INDEX(filterCutoffFrequencyRelease)

    CREATE_CC_INDEX(filterResonanceEnabled)
    CREATE_CC_INDEX(filterResonance)
    CREATE_CC_INDEX(filterResonanceAdsrEnabled)
    CREATE_CC_INDEX(filterResonanceAttack)
    CREATE_CC_INDEX(filterResonanceDecay)
    CREATE_CC_INDEX(filterResonanceSustain)
    CREATE_CC_INDEX(filterResonanceRelease)

    // -----------------------------------------------------------------------------------------------------------------
    // Amplitude tab
    // -----------------------------------------------------------------------------------------------------------------
    CREATE_CC_INDEX(amplitudeEnabled)
    CREATE_CC_INDEX(amplitudeAttack)
    CREATE_CC_INDEX(amplitudeDecay)
    CREATE_CC_INDEX(amplitudeSustain)
    CREATE_CC_INDEX(amplitudeRelease)

    // -----------------------------------------------------------------------------------------------------------------
    // Position tab
    // -----------------------------------------------------------------------------------------------------------------
    CREATE_CC_INDEX(positionEnabled)
    CREATE_CC_INDEX(positionDistanceType)
    CREATE_CC_INDEX(positionDirectionType)
    CREATE_CC_INDEX(positionXYZEnabled)
    CREATE_CC_INDEX(positionX)
    CREATE_CC_INDEX(positionY)
    CREATE_CC_INDEX(positionCartesianZ)
    CREATE_CC_INDEX(positionMaxXYZ)
    CREATE_CC_INDEX(positionRTZEnabled)
    CREATE_CC_INDEX(positionR)
    CREATE_CC_INDEX(positionT)
    CREATE_CC_INDEX(positionPolarZ)
    CREATE_CC_INDEX(positionMaxRZ)

    ; CREATE_CC_INDEX(timeOfLastPositionCalculation)
    CREATE_CC_INDEX(calculatedPositionX)
    CREATE_CC_INDEX(calculatedPositionY)
    CREATE_CC_INDEX(calculatedPositionZ)
    CREATE_CC_INDEX(calculatedDistance) // unused for now
    CREATE_CC_INDEX(calculatedDistanceAttenuation)
    CREATE_CC_INDEX(calculatedDopplerShift) // unused for now

    turnoff
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)


//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"

giMaxDistance = 100
giMinDistance = 5
giMinDistanceAttenuation = AF_3D_Audio_DistanceAttenuation_i(0, giMinDistance, giMaxDistance)


instr SubtractiveSynth_CcEvent
    iCcType = p4
    iCcValue = p5
    iOrcInstanceIndex = p6

    giCcValues[iOrcInstanceIndex][iCcType] = iCcValue
    gkCcValues[iOrcInstanceIndex][iCcType] = iCcValue

    log_k_debug("EVENT_CC %s = %f ...", gSCcInfo[iCcType][$CC_INFO_CHANNEL], iCcValue)

    iCalculatePosition init false
    if (CC_VALUE_i(positionEnabled) == true &&
            CC_INDEX(positionEnabled) <= iCcType &&
            iCcType <= CC_INDEX(positionMaxRZ)) then
        ; log_k_debug("... updating position ...")
        kDopplerShift = 1
        kPosition[] init 3
        kPosition[$X] = 0
        kPosition[$Y] = 0
        kPosition[$Z] = 0
        if (CC_VALUE_i(positionXYZEnabled) == true) then
            ; log_k_debug("... xyz ...")
            kMaxXYZ = CC_VALUE_k(positionMaxXYZ)
            kPosition[$X] = kMaxXYZ * CC_VALUE_k(positionX)
            kPosition[$Y] = kMaxXYZ * CC_VALUE_k(positionY)
            kPosition[$Z] = kMaxXYZ * CC_VALUE_k(positionCartesianZ)
        endif
        if (CC_VALUE_i(positionRTZEnabled) == true) then
            kMaxRZ = CC_VALUE_k(positionMaxRZ)
            kPositionPolarR = kMaxRZ * CC_VALUE_k(positionR)
            kPositionPolarT_radians = $AF_MATH__DEGREES_TO_RADIANS * CC_VALUE_k(positionT)
            kPosition[$X] = kPosition[$X] + kPositionPolarR * sin(kPositionPolarT_radians)
            kPosition[$Y] = kPosition[$Y] + kPositionPolarR * cos(kPositionPolarT_radians)
            kPosition[$Z] = kPosition[$Z] + kMaxRZ *CC_VALUE_k(positionPolarZ)
        endif
        iPositionDistanceType = CC_VALUE_i(positionDistanceType)
        if (iPositionDistanceType == $PositionType_Relative) then
            kPosition[$X] = kPosition[$X] + gk_AF_3D_ListenerPosition[$X]
            kPosition[$Y] = kPosition[$Y] + gk_AF_3D_ListenerPosition[$Y]
            kPosition[$Z] = kPosition[$Z] + gk_AF_3D_ListenerPosition[$Z]
        endif

        kPreviousDistance = CC_VALUE_k(calculatedDistance)
        kListenerDistance = AF_3D_Audio_SourceDistance(kPosition)
        kDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(kListenerDistance, giMinDistance, giMaxDistance)
        ; kPreviousTime = CC_VALUE_k(timeOfLastPositionCalculation)
        ; kCurrentTime = time_k()
        ; if (kPreviousTime == 0 || kPreviousTime < kCurrentTime) then
            ; log_k_debug("... saving updated position (%f, %f, %f) ...", kPosition[$X], kPosition[$Y], kPosition[$Z])
            ; kDopplerShift = AF_3D_Audio_DopplerShift(kPreviousDistance, kListenerDistance, kCurrentTime - kPreviousTime)

            ; gkCcValues[iOrcInstanceIndex][CC_INDEX(timeOfLastPositionCalculation)] = kCurrentTime
            gkCcValues[iOrcInstanceIndex][CC_INDEX(calculatedPositionX)] = kPosition[$X]
            gkCcValues[iOrcInstanceIndex][CC_INDEX(calculatedPositionY)] = kPosition[$Y]
            gkCcValues[iOrcInstanceIndex][CC_INDEX(calculatedPositionZ)] = kPosition[$Z]
            gkCcValues[iOrcInstanceIndex][CC_INDEX(calculatedDistance)] = kListenerDistance
            gkCcValues[iOrcInstanceIndex][CC_INDEX(calculatedDistanceAttenuation)] = kDistanceAttenuation
            gkCcValues[iOrcInstanceIndex][CC_INDEX(calculatedDopplerShift)] = kDopplerShift

            kMinDistanceAttenuation = AF_3D_Audio_DistanceAttenuation(0, giMinDistance, giMaxDistance)
            kRolloffFrequency = 5000 + (15000 * (1 - ((kMinDistanceAttenuation - kDistanceAttenuation) / kMinDistanceAttenuation)))
            
            ; #if LOGGING
            ;     if (changed(kPosition[$X]) == true ||
            ;             changed(kPosition[$Y]) == true ||
            ;             changed(kPosition[$Z]) == true) then
            ;         log_k_debug("xyz = (%f, %f, %f)", kPosition[$X], kPosition[$Y], kPosition[$Z])
            ;         ; log_k_debug("distance = %f, attenuation = %f, dopplerShift = %f",
            ;         ;     kListenerDistance,
            ;         ;     kDistanceAttenuation,
            ;         ;     kDopplerShift)
            ;     endif
            ; #endif
        ; endif
    endif

    ; log_k_debug("EVENT_CC %s - done", gSCcInfo[iCcType][$CC_INFO_CHANNEL])

endin

instr SubtractiveSynth_Note
    iPitch = p4
    iVelocity = p5 / 127
    iOrcInstanceIndex = p6
    iInstrumentTrackIndex = p7

    log_i_trace("iPitch = %f", iPitch)

    kDopplerShift init 1
    ; if (CC_VALUE_i(positionEnabled) == true) then
    ;     kDopplerShift = CC_VALUE_k(calculatedDopplerShift)
    ; endif

    aOut = 0

    #define OSC_INDEX 1
    #include "SubtractiveSynth.osc.orc"
    #undef OSC_INDEX
    #define OSC_INDEX 2
    #include "SubtractiveSynth.osc.orc"
    #undef OSC_INDEX
    #define OSC_INDEX 3
    #include "SubtractiveSynth.osc.orc"
    #undef OSC_INDEX
    #define OSC_INDEX 4
    #include "SubtractiveSynth.osc.orc"
    #undef OSC_INDEX

    if (CC_VALUE_i(filterEnabled) == true) then
        kFilterCutoffFrequency init CC_VALUE_default(filterCutoffFrequency)
        if (CC_VALUE_i(filterCutoffFrequencyEnabled) == true) then
            kFilterCutoffFrequency = CC_VALUE_k(filterCutoffFrequency)
        endif

        kFilterResonance init CC_VALUE_default(filterResonance)
        if (CC_VALUE_i(filterResonanceEnabled) == true) then
            kFilterResonance = CC_VALUE_k(filterResonance)
        endif

        if (CC_VALUE_i(filterCutoffFrequencyAdsrEnabled) == true) then
            iFilterCutoffFrequencyDefault = CC_VALUE_default(filterCutoffFrequency)
            kFilterCutoffFrequencyAdsr = adsr_linsegr(
                CC_VALUE_i(filterCutoffFrequencyAttack),
                CC_VALUE_i(filterCutoffFrequencyDecay),
                CC_VALUE_i(filterCutoffFrequencySustain),
                CC_VALUE_i(filterCutoffFrequencyRelease))
            kFilterCutoffFrequency = iFilterCutoffFrequencyDefault -
                (kFilterCutoffFrequencyAdsr * (iFilterCutoffFrequencyDefault - kFilterCutoffFrequency))
        endif

        if (CC_VALUE_i(filterResonanceAdsrEnabled) == true) then
            iFilterResonanceDefault = CC_VALUE_default(filterResonance)
            kFilterResonanceAdsr = adsr_linsegr(
                CC_VALUE_i(filterResonanceAttack),
                CC_VALUE_i(filterResonanceDecay),
                CC_VALUE_i(filterResonanceSustain),
                CC_VALUE_i(filterResonanceRelease))
            kFilterResonance = iFilterResonanceDefault -
                (kFilterResonanceAdsr * (iFilterResonanceDefault - kFilterResonance))
        endif

        aOut = moogladder(aOut, kFilterCutoffFrequency, kFilterResonance)
    endif

    if (CC_VALUE_i(amplitudeEnabled) == true) then
        log_i_debug("adsr = %f, %f, %f, %f", CC_VALUE_i(amplitudeAttack), CC_VALUE_i(amplitudeDecay),
            CC_VALUE_i(amplitudeSustain), CC_VALUE_i(amplitudeRelease))
        aOut *= adsr_linsegr(CC_VALUE_i(amplitudeAttack), CC_VALUE_i(amplitudeDecay), CC_VALUE_i(amplitudeSustain),
            CC_VALUE_i(amplitudeRelease))
    endif

    iPositionEnabled = CC_VALUE_i(positionEnabled)
    if (iPositionEnabled == true) then
        // Calculate signal to reverb before attenuating to simulate distance. These parameters will probably need
        // to be adjusted for each different type of sound.
        kDistanceAttenuation = CC_VALUE_k(calculatedDistanceAttenuation)
        kRolloffFrequency =
            5000 + (15000 * (1 - ((giMinDistanceAttenuation - kDistanceAttenuation) / giMinDistanceAttenuation)))
        aOut = tone(aOut, kRolloffFrequency)
        aReverbSendSignal = aOut

        // Attenuate signal by listener distance.
        aOut *= kDistanceAttenuation
    else
        aReverbSendSignal = aOut
    endif

    ; log_i_debug("iOrcInstanceIndex = %d", iOrcInstanceIndex)
    ; log_i_debug("iInstrumentTrackIndex = %d", iInstrumentTrackIndex)

    if (nchnls == 6) then
        // Assume channels 1-4 are for first order ambisonics, with channels 5 and 6 for reverb left and right.

        // Output ambisonic channels 1-4.
        if (iPositionEnabled == true) then
            kAmbisonicChannelGains[] = AF_3D_Audio_ChannelGains_XYZ(
                CC_VALUE_k(calculatedPositionX),
                CC_VALUE_k(calculatedPositionY),
                CC_VALUE_k(calculatedPositionZ))
        else
            kAmbisonicChannelGains[] = fillarray(1, 1, 1, 1)
        endif
        kI = 0
        while (kI < 4) do
            // NB: kAmbisonicChannelGains[kI] causes a Csound compile error if it's put in the outch opcode,
            // but it works fine if it's assigned to a k variable that's put in the outch opcode.
            // TODO: File bug report?
            kAmbisonicChannelGain = kAmbisonicChannelGains[kI]
            kI += 1
            outch(kI, kAmbisonicChannelGain * aOut)
        od

        // Output reverb channels 5 and 6.
        outch(5, aReverbSendSignal)
        outch(6, aReverbSendSignal)
    else
        // All channel configurations other than 6 are not supported, yet, so just copy the `aOut` signal to all
        // output channels for now.
        kI = 0
        while (kI < nchnls) do
            kI += 1
            outch(kI, aOut)
        od
    endif
endin

giSubtractiveSynthCcEventInstrumentNumber = nstrnum("SubtractiveSynth_CcEvent")
giSubtractiveSynthNoteInstrumentNumber = nstrnum("SubtractiveSynth_Note")

#endif // #ifndef SubtractiveSynth_orc__include_guard


instr INSTRUMENT_ID
    ; log_i_debug("p1 = %f", p1)
    ; log_i_debug("track index = %d", iInstrumentTrackIndex)

    #if LOGGING
        #ifdef INSTRUMENT_ID_DEFINED
            SInstrument = sprintf("%.3f", p1)
        #else
            SInstrument = sprintf("%s.%03d", nstrstr(p1), 1000 * frac(p1))
        #endif
        log_i_info("%s ...", SInstrument)
    #endif

    iEventType = p4
    if (iEventType == EVENT_CC) then
        aUnused subinstr giSubtractiveSynthCcEventInstrumentNumber, p5, p6, ORC_INSTANCE_INDEX
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        a1, a2, a3, a4, a5, a6 subinstr giSubtractiveSynthNoteInstrumentNumber, p5, p6, ORC_INSTANCE_INDEX,
            INSTRUMENT_TRACK_INDEX

        #if IS_PLAYBACK
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] + a1
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] + a2
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] + a3
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] + a4
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] + a5
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] + a6
        #else
            outch(1, a1)
            outch(2, a2)
            outch(3, a3)
            outch(4, a4)
            outch(5, a5)
            outch(6, a6)
        #endif
    endif

    log_i_info("%s - done", SInstrument)
endin

//----------------------------------------------------------------------------------------------------------------------
