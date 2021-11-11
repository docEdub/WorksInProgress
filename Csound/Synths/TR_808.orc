#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: TR_808.orc
//
// Description:
//  Single triangle wave oscillator with piano-like decay.
//
// Based on Iain McCurdy's .csd. See http://iainmccurdy.org/csound.html.
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"


#ifndef TR_808_orc__include_guard
#define TR_808_orc__include_guard

${CSOUND_INCLUDE} "adsr_linsegr.udo.orc"

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    "example",                                  "bool",     "false",            "synced", _(\)
_(\)
    "",                                         "",         "",                 "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #8#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    CREATE_CC_INDEX(example)

    turnoff
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
${CSOUND_INCLUDE} "math.orc"
${CSOUND_INCLUDE} "time.orc"


#define TR_808_BASS_DRUM_KEY 37 // C#3
#define TR_808_SNARE_DRUM_KEY 39 // D#3
#define TR_808_RIM_SHOT_KEY 40 // E3

#define TR_808_LOW_TOM_KEY 42 // F#3
#define TR_808_MID_TOM_KEY 44 // G#3
#define TR_808_HIGH_TOM_KEY 46 // A#4

#define TR_808_CLOSED_HIGH_HAT_KEY 49 // C#4
#define TR_808_OPEN_HIGH_HAT_KEY 51 // D#4

#define TR_808_CYMBAL_KEY 54 // F#4
#define TR_808_COWBELL_KEY 56 // G#4
#define TR_808_CLAP_KEY 58 // A#5

#define TR_808_CLAVES_KEY 61 // C#5
#define TR_808_MARACA_KEY 63 // D#5

#define TR_808_LOW_CONGA_KEY 66 // F#5
#define TR_808_MID_CONGA_KEY 68 // G#5
#define TR_808_HIGH_CONGA_KEY 70 // A#6


giTR_808_MaxAmpWhenVeryClose = 1
giTR_808_ReferenceDistance = 0.1
giTR_808_RolloffFactor = 0.005
giTR_808_PlaybackVolumeAdjustment = 1
giTR_808_PlaybackReverbAdjustment = 1

giTR_808_BassDrum_Level = 1
giTR_808_BassDrum_Decay = 1
giTR_808_BassDrum_Tune init 0

giTR_808_SnareDrum_Level = 1
giTR_808_SnareDrum_Decay = 1
giTR_808_SnareDrum_Tune init 0

giTR_808_OpenHighHat_Level = 1
giTR_808_OpenHighHat_Decay = 1
giTR_808_OpenHighHat_Tune init 0

giTR_808_ClosedHighHat_Level = 1
giTR_808_ClosedHighHat_Decay = 1
giTR_808_ClosedHighHat_Tune init 0

giTR_808_NoteIndex[] init ORC_INSTANCE_COUNT

giTR_808_Sine_TableNumber = ftgen(0, 0, 1024, 10, 1)
giTR_808_Cosine_TableNumber = ftgen(0, 0, 65536, 9, 1, 1, 90)



gisine = giTR_808_Sine_TableNumber
gicos = giTR_808_Cosine_TableNumber

gklevel1 init giTR_808_BassDrum_Level
gkdur1   init giTR_808_BassDrum_Decay
gktune1  init giTR_808_BassDrum_Tune

gklevel2 init giTR_808_SnareDrum_Level
gkdur2   init giTR_808_SnareDrum_Decay
gktune2  init giTR_808_SnareDrum_Tune

gklevel3 init giTR_808_OpenHighHat_Level
gkdur3   init giTR_808_OpenHighHat_Decay
gktune3  init giTR_808_OpenHighHat_Tune

gklevel4 init giTR_808_ClosedHighHat_Level
gkdur4   init giTR_808_ClosedHighHat_Decay
gktune4  init giTR_808_ClosedHighHat_Tune

gklevel init 1


#endif // #ifndef TR_808_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr TR_808_Json
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, "}")
        turnoff
    endin
${CSOUND_ENDIF}


instr INSTRUMENT_ID
    iEventType = p4
    if (iEventType == EVENT_CC) then
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        iNoteNumber = p5
        iVelocity = p6

        aOut init 0

        // Map velocity [0, 127] to dB [-30, 0] and adjust for 0dbfs = 1.
        iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)

        log_i_debug("iNoteNumber == %d", iNoteNumber)

        if (iNoteNumber == TR_808_BASS_DRUM_KEY) then
            //----------------------------------------------------------------------------------------------------------
            // Bass drum
            //----------------------------------------------------------------------------------------------------------
            log_i_trace("Bass drum triggered")

            iNoteDuration = 2 * giTR_808_BassDrum_Decay
            p3 = iNoteDuration
            xtratim(0.1)

            // Sustain and body of the sound.
            //----------------------------------------------------------------------------------------------------------
            // Partial strengths multiplier used by the gbuzz opcode. Decays from a sound with overtones to a sine tone.
            kmul = transeg:k(0.2, iNoteDuration * 0.5, -15, 0.01, iNoteDuration * 0.5, 0, 0)
            // Slight pitch bend at the start of the note.
            kbend = transeg:k(0.5, 1.2, -4, 0, 1, 0, 0)
            // Tone.
            asig = gbuzz(0.5, 50 * octave:k(giTR_808_BassDrum_Tune) * semitone:k(kbend), 20, 1, kmul, giTR_808_Cosine_TableNumber)
            // Amplitude envelope for sustain of the sound.
            aenv = transeg:a(1, iNoteDuration - 0.004, -6, 0)
            // Soft attack.
            aatt = linseg:a(0, 0.004, 1)

            asig = asig * aenv * aatt

            // Hard and short attack of the sound.
            //----------------------------------------------------------------------------------------------------------
            // Amplitude envelope (fast decay).
            aenv = linseg:a(1, 0.07, 0)
            // Frequency of the attack sound. Quickly glisses from 400 Hz to sub-audio. 
            acps = expsega(400, 0.07, 0.001, 1, 0.001)
            // Attack sound.
            aimp = oscili(aenv, acps * octave(giTR_808_BassDrum_Tune * 0.25), giTR_808_Sine_TableNumber)

            // Mix sustain and attack sound elements and scale using global bass drum level.
            aOut = ((asig * 0.5) + (aimp * 0.35)) * giTR_808_BassDrum_Level * iAmp

        elseif (iNoteNumber == TR_808_SNARE_DRUM_KEY) then
            //----------------------------------------------------------------------------------------------------------
            // Snare
            //----------------------------------------------------------------------------------------------------------
            log_i_trace("Snare triggered")

            // Sound is 2 sine tones an octave apart and a noise signal.
            //
            // Frequency of the tones.
            ifrq = 342
            // Noise signal duration.
            iNseDur = 0.3 * giTR_808_SnareDrum_Decay
            // Sine tones duration.
            iPchDur = 0.1 * giTR_808_SnareDrum_Decay

            iNoteDuration = iNseDur
            p3 = iNoteDuration
            
            // Sine tones.
            //----------------------------------------------------------------------------------------------------------
            // Amplitude envelope.
            aenv1 = expseg(1, iPchDur, 0.0001, iNoteDuration - iPchDur, 0.0001)
            // Sine tone 1.
            apitch1	= oscili(1, ifrq * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)
            // Sine tone 2 (an otave lower).
            apitch2	= oscili(0.25, ifrq * 0.5 * octave(giTR_808_SnareDrum_Tune), giTR_808_Sine_TableNumber)

            apitch = (apitch1 + apitch2) * 0.75

            // Noise
            //----------------------------------------------------------------------------------------------------------
            // Amplitude envelope.
            aenv2 = expon(1, iNoteDuration, 0.0005)
            // Create some noise.
            anoise = noise(0.75, 0)
            // Bandpass filter the noise signal.
            anoise = butbp(anoise, 10000 * octave(giTR_808_SnareDrum_Tune), 10000)
            // Highpass filter the noise signal.
            anoise = buthp(anoise, 1000)
            // Cutoff frequency for a lowpass filter
            kcf = expseg(5000, 0.1, 3000, iNoteDuration - 0.2, 3000)
            // Lowpass filter the noise signal
            anoise = butlp(anoise, kcf)

            aOut = ((apitch * aenv1) + (anoise * aenv2)) * giTR_808_SnareDrum_Level * iAmp

        elseif (iNoteNumber == TR_808_OPEN_HIGH_HAT_KEY) then
            //----------------------------------------------------------------------------------------------------------
            // Open high hat
            //----------------------------------------------------------------------------------------------------------
            log_i_trace("Open high hat triggered")

            xtratim(0.1)

            // Sound is 6 pulse oscillators and a noise signal.
            //
            // Frequencies of the 6 oscillators.
            kFrq1 = 296 * octave(giTR_808_OpenHighHat_Tune)
            kFrq2 = 285 * octave(giTR_808_OpenHighHat_Tune)
            kFrq3 = 365 * octave(giTR_808_OpenHighHat_Tune)
            kFrq4 = 348 * octave(giTR_808_OpenHighHat_Tune)
            kFrq5 = 420 * octave(giTR_808_OpenHighHat_Tune)
            kFrq6 = 835 * octave(giTR_808_OpenHighHat_Tune)

            // Duration of the note.
            iNoteDuration = 0.5 * giTR_808_OpenHighHat_Decay
            p3 = iNoteDuration
            
            // Pitched element
            //----------------------------------------------------------------------------------------------------------
            // Amplitude envelope for the pulse oscillators.
            aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
            // Pulse width.
            ipw = 0.25
            // Pulse oscillators.
            a1 = vco2(0.5, kFrq1, 2, ipw)
            a2 = vco2(0.5, kFrq2, 2, ipw)
            a3 = vco2(0.5, kFrq3, 2, ipw)
            a4 = vco2(0.5, kFrq4, 2, ipw)
            a5 = vco2(0.5, kFrq5, 2, ipw)
            a6 = vco2(0.5, kFrq6, 2, ipw)

            // Mix the pulse oscillators.
            amix = sum(a1, a2, a3, a4, a5, a6)
            // Bandpass filter the pulse oscillators.
            amix = reson(amix, 5000 * octave(giTR_808_OpenHighHat_Tune), 5000, 1)
            // Highpass filter the pulse oscillators, twice.
            amix = buthp(amix, 5000)
            amix = buthp(amix, 5000)
            // Apply the amplitude envelope.
            amix = (amix * aenv)
            
            // Noise element
            //----------------------------------------------------------------------------------------------------------
            // Amplitude envelope for the noise.
            aenv = linseg(1, iNoteDuration - 0.05, 0.1, 0.05, 0)
            // White noise.
            anoise = noise(0.8, 0)
            // Cutoff frequency envelope for a lowpass filter
            kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
            // Lowpass filter the noise signal.
            anoise = butlp(anoise, kcf)
            // Highpass filter the noise signal.
            anoise = buthp(anoise, 8000)
            // Apply the amplitude envelope.
            anoise = anoise * aenv
            
            // Mix pulse oscillator and noise.
            aOut = (amix + anoise) * giTR_808_OpenHighHat_Level * iAmp * 0.55

        elseif (iNoteNumber == TR_808_CLOSED_HIGH_HAT_KEY) then
            //----------------------------------------------------------------------------------------------------------
            // Closed high hat
            //----------------------------------------------------------------------------------------------------------
            log_i_trace("Closed high hat triggered")

            xtratim	0.1

            // Sound is 6 pulse oscillators and a noise signal.
            //
            // Frequencies of the 6 oscillators.
            kFrq1 = 296 * octave(giTR_808_ClosedHighHat_Tune)
            kFrq2 = 285 * octave(giTR_808_ClosedHighHat_Tune) 	
            kFrq3 = 365 * octave(giTR_808_ClosedHighHat_Tune) 	
            kFrq4 = 348 * octave(giTR_808_ClosedHighHat_Tune) 	
            kFrq5 = 420 * octave(giTR_808_ClosedHighHat_Tune) 	
            kFrq6 = 835 * octave(giTR_808_ClosedHighHat_Tune)

            // Duration of the note.
            iNoteDuration = limit(0.088 * giTR_808_ClosedHighHat_Decay, 0.1, 10)
            p3 = iNoteDuration

            // Pitched element
            //----------------------------------------------------------------------------------------------------------
            // Amplitude envelope for the pulse oscillators.
            aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
            // Pulse width.
            ipw = 0.25
            // Pulse oscillators.
            a1 = vco2(0.5, kFrq1, 2, ipw)
            a2 = vco2(0.5, kFrq2, 2, ipw)
            a3 = vco2(0.5, kFrq3, 2, ipw)
            a4 = vco2(0.5, kFrq4, 2, ipw)
            a5 = vco2(0.5, kFrq5, 2, ipw)
            a6 = vco2(0.5, kFrq6, 2, ipw)

            // Mix the pulse oscillators.
            amix = sum(a1, a2, a3, a4, a5, a6)
            // Bandpass filter the pulse oscillators.
            amix = reson(amix, 5000 * octave(giTR_808_ClosedHighHat_Tune), 5000, 1)
            // Highpass filter the pulse oscillators, twice.
            amix = buthp(amix, 5000)
            amix = buthp(amix, 5000)
            // Apply the amplitude envelope.
            amix = (amix * aenv)
            
            // Noise element.
            //----------------------------------------------------------------------------------------------------------
            // Amplitude envelope for the noise.
            aenv = expsega(1, iNoteDuration, 0.001, 1, 0.001)
            // White noise.
            anoise = noise(0.8, 0)
            // Cutoff frequency envelope for a lowpass filter            
            kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
            // Lowpass filter the noise signal.
            anoise = butlp(anoise, kcf)
            // Highpass filter the noise signal.
            anoise = buthp(anoise, 8000)
            // Apply the amplitude envelope.
            anoise = anoise * aenv
            
            // Mix pulse oscillator and noise.
            aOut = (amix + anoise) * giTR_808_ClosedHighHat_Level * iAmp * 0.55

        endif

        #if IS_PLAYBACK
            ; gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = aOut
            ; gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = aOut
            ; gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = aOut
            gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = aOut
        #else
            kReloaded init false
            kFadeTimeLeft init 0.1
            if (gkReloaded == true) then
                log_k_debug("Turning off instrument %.04f due to reload.", p1)
                kReloaded = gkReloaded
            endif
            if (kReloaded == true) then
                kFadeTimeLeft -= 1 / kr
                if (kFadeTimeLeft <= 0) then
                    turnoff
                endif
            endif
            outc(a(0), a(0), a(0), aOut, aOut, aOut)
        #endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (giTR_808_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"TR_808_Json\" 0 0")
            endif
            giTR_808_NoteIndex[ORC_INSTANCE_INDEX] = giTR_808_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giTR_808_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f}}", times())
            ficlose(SJsonFile)
        ${CSOUND_ENDIF}
    endif
end:
endin

//----------------------------------------------------------------------------------------------------------------------
