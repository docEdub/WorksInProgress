#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: TR_808.orc
//
// Description:
//  Emulation of the Roland TR-808 drum machine.
//
// Based on Iain McCurdy's .csd. See http://iainmccurdy.org/csound.html.
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"
#include "Position_defines.h"


#ifndef TR_808_orc__include_guard
#define TR_808_orc__include_guard

${CSOUND_INCLUDE} "adsr_linsegr.udo.orc"

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    POSITION_CC_INFO
_(\)
    "",                                         "",         "",                 "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #52#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    #include "Position_ccIndexes.orc"
    turnoff
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
${CSOUND_INCLUDE} "math.orc"
${CSOUND_INCLUDE} "PositionUdos.orc"


#define TR_808_BASS_DRUM_KEY 37 // C#1
#define TR_808_SNARE_DRUM_KEY 39 // D#1
#define TR_808_RIM_SHOT_KEY 40 // E1

#define TR_808_LOW_TOM_KEY 42 // F#1
#define TR_808_MID_TOM_KEY 44 // G#1
#define TR_808_HIGH_TOM_KEY 46 // A#2

#define TR_808_CLOSED_HIGH_HAT_KEY 49 // C#2
#define TR_808_OPEN_HIGH_HAT_KEY 51 // D#2

#define TR_808_CYMBAL_KEY 54 // F#2
#define TR_808_COWBELL_KEY 56 // G#2
#define TR_808_CLAP_KEY 58 // A#3

#define TR_808_CLAVES_KEY 61 // C#3
#define TR_808_MARACA_KEY 63 // D#3

#define TR_808_LOW_CONGA_KEY 66 // F#3
#define TR_808_MID_CONGA_KEY 68 // G#3
#define TR_808_HIGH_CONGA_KEY 70 // A#4


giTR_808_PlaybackVolumeAdjustment = 1
giTR_808_PlaybackReverbAdjustment = 1


giTR_808_BassDrum_Level = 1
giTR_808_BassDrum_Decay = 1
giTR_808_BassDrum_Tune init 0

giTR_808_BassDrum_HighPassCutoffFrequencyHz = 80
giTR_808_BassDrum_LowPassCutoffFrequencyHz = 1000


giTR_808_SnareDrum_Level = 1
giTR_808_SnareDrum_Decay = 1
giTR_808_SnareDrum_Tune init 0


giTR_808_OpenHighHat_Level = 1
giTR_808_OpenHighHat_Decay = 1
giTR_808_OpenHighHat_Tune init 0

giTR_808_ClosedHighHat_Level = 1
giTR_808_ClosedHighHat_Decay = 1
giTR_808_ClosedHighHat_Tune init 0

giTR_808_HighHat_HighPassCutoffFrequencyHz = 20000


giTR_808_NoteIndex[] init ORC_INSTANCE_COUNT

giTR_808_Sine_TableNumber = ftgen(0, 0, 1024, 10, 1)
giTR_808_Cosine_TableNumber = ftgen(0, 0, 65536, 9, 1, 1, 90)

giTR_808_SampleCacheLongestDuration = 10.1 // seconds
gkTR_808_SampleCacheCps init 1 / giTR_808_SampleCacheLongestDuration
giTR_808_SampleCacheNoteNumbers[] fillarray \
    TR_808_BASS_DRUM_KEY,
    TR_808_SNARE_DRUM_KEY,
    TR_808_RIM_SHOT_KEY,
    TR_808_LOW_TOM_KEY,
    TR_808_MID_TOM_KEY,
    TR_808_HIGH_TOM_KEY,
    TR_808_CLOSED_HIGH_HAT_KEY,
    TR_808_OPEN_HIGH_HAT_KEY,
    TR_808_CYMBAL_KEY,
    TR_808_COWBELL_KEY,
    TR_808_CLAP_KEY,
    TR_808_CLAVES_KEY,
    TR_808_MARACA_KEY,
    TR_808_LOW_CONGA_KEY,
    TR_808_MID_CONGA_KEY,
    TR_808_HIGH_CONGA_KEY

giTR_808_SampleCacheTableNumbers[] init lenarray(giTR_808_SampleCacheNoteNumbers)
giTR_808_SampleCacheLength init sr * giTR_808_SampleCacheLongestDuration
giTR_808_SampleCacheTableLength = 2
while (giTR_808_SampleCacheTableLength < giTR_808_SampleCacheLength) do
    giTR_808_SampleCacheTableLength *= 2
od
log_i_debug("giTR_808_SampleCacheTableLength = %d", giTR_808_SampleCacheTableLength)

ii = 0
while (ii < lenarray(giTR_808_SampleCacheNoteNumbers)) do
    // Generate empty tables to hold each note's sample cache.
    giTR_808_SampleCacheTableNumbers[ii] = ftgen(0, 0, giTR_808_SampleCacheTableLength, 2, 0)
    ii += 1
od

instr FillSampleCache_TR_808
    #if IS_PLAYBACK
        iInsrumentNumber = INSTRUMENT_ID
    #else
        iInsrumentNumber = nstrnum(STRINGIZE(INSTRUMENT_ID))
    #endif

    ii = 0
    while (ii < lenarray(giTR_808_SampleCacheNoteNumbers)) do
        prints("Filling TR_808 sample cache for note %d\n", giTR_808_SampleCacheNoteNumbers[ii])
        scoreline_i(sprintf(
            "i %d 0 %f %d %d 127",
            iInsrumentNumber,
            ${MIDI_NOTE_DURATION},
            EVENT_NOTE_CACHE,
            giTR_808_SampleCacheNoteNumbers[ii]))
        ii += 1
    od
    turnoff
endin
scoreline_i("i \"FillSampleCache_TR_808\" 0 -1")

#endif // #ifndef TR_808_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    gSPluginUuids[INSTRUMENT_TRACK_INDEX][INSTRUMENT_PLUGIN_INDEX] = INSTRUMENT_PLUGIN_UUID

    instr CONCAT(Json_, INSTRUMENT_ID)
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, "}")
        turnoff
    endin
${CSOUND_ENDIF}


instr INSTRUMENT_ID
    iOrcInstanceIndex = ORC_INSTANCE_INDEX
    iEventType = p4
    if (iEventType == EVENT_CC) then
        iCcIndex = p5
        iCcValue = p6
        if (strcmp(gSCcInfo[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
            gSCcValues[ORC_INSTANCE_INDEX][iCcIndex] = strget(iCcValue)
        else
            giCcValues[ORC_INSTANCE_INDEX][iCcIndex] = iCcValue
            gkCcValues[ORC_INSTANCE_INDEX][iCcIndex] = iCcValue
        endif
        turnoff
    elseif (iEventType == EVENT_NOTE_ON || iEventType == EVENT_NOTE_CACHE) then
        iNoteNumber = p5

        aOut init 0

        iSampleCacheIndex = -1
        ii = 0
        while (ii < lenarray(giTR_808_SampleCacheNoteNumbers)) do
            if (iNoteNumber == giTR_808_SampleCacheNoteNumbers[ii]) then
                iSampleCacheIndex = ii
                ii = lenarray(giTR_808_SampleCacheNoteNumbers) // kick out of while loop
            endif
            ii += 1
        od
        if (iSampleCacheIndex == -1 || iSampleCacheIndex >= lenarray(giTR_808_SampleCacheNoteNumbers)) then
            log_i_warning("Sample cache for note number %d not found", iNoteNumber)
            turnoff
        endif
        log_i_debug("iNoteNumber = %d, iSampleCacheIndex = %d", iNoteNumber, iSampleCacheIndex)

        iNoteDuration init p3
        if (iNoteNumber == TR_808_BASS_DRUM_KEY) then
            log_i_trace("Bass drum triggered")
            iNoteDuration = 2 * giTR_808_BassDrum_Decay
            xtratim(0.1)
        elseif (iNoteNumber == TR_808_SNARE_DRUM_KEY) then
            log_i_trace("Snare triggered")
            iNoteDuration = 0.3 * giTR_808_SnareDrum_Decay
        elseif (iNoteNumber == TR_808_OPEN_HIGH_HAT_KEY) then
            log_i_trace("Open high hat triggered")
            iNoteDuration = 0.5 * giTR_808_OpenHighHat_Decay
            xtratim(0.1)
        elseif (iNoteNumber == TR_808_CLOSED_HIGH_HAT_KEY) then
            log_i_trace("Closed high hat triggered")
            if (iEventType == EVENT_NOTE_ON) then
                iNoteDuration = limit(0.088 * giTR_808_ClosedHighHat_Decay, 0.1, 10)
            else
                iNoteDuration = 10
            endif
            xtratim(0.1)
        endif

        aAmpEnvelope init 1
        if (iEventType == EVENT_NOTE_ON) then
            if (iNoteNumber == TR_808_CLOSED_HIGH_HAT_KEY) then
                aAmpEnvelope = expsega(1, iNoteDuration, 0.001, 1, 0.001)
            endif
        endif

        log_i_debug("iNoteDuration = %f", iNoteDuration)
        p3 = iNoteDuration

        if (iEventType == EVENT_NOTE_CACHE) then
            log_i_debug("iNoteDuration = %f", iNoteDuration)
            if (iNoteNumber == TR_808_BASS_DRUM_KEY) then
                log_i_debug("iNoteDuration = %f", iNoteDuration)
                //----------------------------------------------------------------------------------------------------------
                // Bass drum
                //----------------------------------------------------------------------------------------------------------

                // Sustain and body of the sound.
                //----------------------------------------------------------------------------------------------------------
                // Partial strengths multiplier used by the gbuzz opcode. Decays from a sound with overtones to a sine tone.
                kmul = transeg:k(0.2, iNoteDuration * 0.5, -15, 0.01, iNoteDuration * 0.5, 0, 0)
                // Slight pitch bend at the start of the note.
                kbend = transeg:k(0.5, 1.2, -4, 0, 1, 0, 0)
                // Tone.
                asig = gbuzz(0.5, 50 * octave:k(giTR_808_BassDrum_Tune) * semitone:k(kbend), 20, 1, kmul,
                    giTR_808_Cosine_TableNumber)
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
                aOut = ((asig * 0.5) + (aimp * 0.35)) * giTR_808_BassDrum_Level

                // Roll off lows with high pass filter.
                aOut = atone(aOut, k(giTR_808_BassDrum_HighPassCutoffFrequencyHz))

                // Roll off highs with low pass filter.
                aOut = tone(aOut, k(giTR_808_BassDrum_LowPassCutoffFrequencyHz))

            elseif (iNoteNumber == TR_808_SNARE_DRUM_KEY) then
                //----------------------------------------------------------------------------------------------------------
                // Snare
                //----------------------------------------------------------------------------------------------------------

                // Sound is 2 sine tones an octave apart and a noise signal.
                //
                // Frequency of the tones.
                ifrq = 342
                // Noise signal duration.
                iNseDur = iNoteDuration
                // Sine tones duration.
                iPchDur = 0.1 * giTR_808_SnareDrum_Decay

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

                aOut = ((apitch * aenv1) + (anoise * aenv2)) * giTR_808_SnareDrum_Level

            elseif (iNoteNumber == TR_808_OPEN_HIGH_HAT_KEY) then
                //----------------------------------------------------------------------------------------------------------
                // Open high hat
                //----------------------------------------------------------------------------------------------------------

                // Sound is 6 pulse oscillators and a noise signal.
                //
                // Frequencies of the 6 oscillators.
                kFrq1 = 296 * octave(giTR_808_OpenHighHat_Tune)
                kFrq2 = 285 * octave(giTR_808_OpenHighHat_Tune)
                kFrq3 = 365 * octave(giTR_808_OpenHighHat_Tune)
                kFrq4 = 348 * octave(giTR_808_OpenHighHat_Tune)
                kFrq5 = 420 * octave(giTR_808_OpenHighHat_Tune)
                kFrq6 = 835 * octave(giTR_808_OpenHighHat_Tune)

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
                aOut = (amix + anoise) * giTR_808_OpenHighHat_Level * 0.55

                // Roll off lows with high pass filter.
                aOut = atone(aOut, k(giTR_808_HighHat_HighPassCutoffFrequencyHz))

            elseif (iNoteNumber == TR_808_CLOSED_HIGH_HAT_KEY) then
                //----------------------------------------------------------------------------------------------------------
                // Closed high hat
                //----------------------------------------------------------------------------------------------------------

                // Sound is 6 pulse oscillators and a noise signal.
                //
                // Frequencies of the 6 oscillators.
                kFrq1 = 296 * octave(giTR_808_ClosedHighHat_Tune)
                kFrq2 = 285 * octave(giTR_808_ClosedHighHat_Tune)
                kFrq3 = 365 * octave(giTR_808_ClosedHighHat_Tune)
                kFrq4 = 348 * octave(giTR_808_ClosedHighHat_Tune)
                kFrq5 = 420 * octave(giTR_808_ClosedHighHat_Tune)
                kFrq6 = 835 * octave(giTR_808_ClosedHighHat_Tune)

                // Pitched element
                //----------------------------------------------------------------------------------------------------------
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

                // Noise element.
                //----------------------------------------------------------------------------------------------------------
                // White noise.
                anoise = noise(0.8, 0)
                // Cutoff frequency envelope for a lowpass filter
                kcf = expseg(20000, 0.7, 9000, iNoteDuration - 0.1, 9000)
                // Lowpass filter the noise signal.
                anoise = butlp(anoise, kcf)
                // Highpass filter the noise signal.
                anoise = buthp(anoise, 8000)

                // Mix pulse oscillator and noise.
                aOut = (amix + anoise) * giTR_808_ClosedHighHat_Level * 0.55

                // Roll off lows with high pass filter.
                aOut = atone(aOut, k(giTR_808_HighHat_HighPassCutoffFrequencyHz))

            endif

            // Copy `aOut` into note's sample cache table at sample offset `kPass` * ksmps.
            kPass init 0
            tablew(aOut, a(kPass * ksmps), giTR_808_SampleCacheTableNumbers[iSampleCacheIndex])
            kPass += 1

        elseif (iEventType == EVENT_NOTE_ON) then
            iVelocity = p6

            // Map velocity [0, 127] to dB [-30, 0] and adjust for 0dbfs = 1.
            iAmp = ampdbfs(((iVelocity / 127) - 1) * 30)
            log_i_debug("iAmp = %f", iAmp)

            // Read `aOut` from note's sample cache.
            aOut = oscil:a(iAmp, gkTR_808_SampleCacheCps, giTR_808_SampleCacheTableNumbers[iSampleCacheIndex]) * aAmpEnvelope

            if (CC_VALUE_i(positionEnabled) == true) then
                ; log_i_trace("Calling position UDO ...")
                #include "Position_iXYZ.orc"

                aDistance = AF_3D_Audio_SourceDistance_a(kX, kY, kZ)
                aDistanceAmp = AF_3D_Audio_DistanceAttenuation:a(aDistance, kPositionReferenceDistance, kPositionRolloffFactor)
                aDistanceAmp = min(aDistanceAmp, a(kPositionMaxAmpWhenClose))
                aDistancedOut = aOut * aDistanceAmp
                aAuxOut = aOut * min((aDistanceAmp * 3), a(0.5))

                AF_3D_Audio_ChannelGains_XYZ(iX, iY, iZ)
                a1 = a(gkAmbisonicChannelGains[0]) * aDistancedOut
                a2 = a(gkAmbisonicChannelGains[1]) * aDistancedOut
                a3 = a(gkAmbisonicChannelGains[2]) * aDistancedOut
                a4 = a(gkAmbisonicChannelGains[3]) * aDistancedOut
            else
                // Disabled.
                a1 = aDistancedOut
                a2 = 0
                a3 = 0
                a4 = 0
            endif

            #if IS_PLAYBACK
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = a1
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = a2
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = a3
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = a4
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = aAuxOut
                gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = aAuxOut
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
                outc(a1, a2, a3, a4, aAuxOut, aAuxOut)
            #endif

            ${CSOUND_IFDEF} IS_GENERATING_JSON
                if (giTR_808_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                    scoreline_i(sprintf("i \"%s\" 0 0", STRINGIZE(CONCAT(Json_, INSTRUMENT_ID))))
                endif
                giTR_808_NoteIndex[ORC_INSTANCE_INDEX] = giTR_808_NoteIndex[ORC_INSTANCE_INDEX] + 1
                SJsonFile = sprintf("json/%s.%d.json", INSTRUMENT_PLUGIN_UUID, giTR_808_NoteIndex[ORC_INSTANCE_INDEX])
                fprints(SJsonFile, "{\"note\":{\"onTime\":%.3f", times())
                if (CC_VALUE_i(positionEnabled) == true) then
                    fprints(SJsonFile, ",\"xyz\":[%.3f,%.3f,%.3f]", iX, iY, iZ)
                endif
                fprints(SJsonFile, "}}")
                ficlose(SJsonFile)
            ${CSOUND_ENDIF}
        endif
    endif
end:
endin

#if IS_PLAYBACK
    instr CONCAT(Preallocate_, INSTRUMENT_ID)
        ii = 0
        while (ii < giPresetUuidPreallocationCount[INSTRUMENT_TRACK_INDEX]) do
            scoreline_i(sprintf("i %d.%.3d 0 .1 %d 63 63", INSTRUMENT_ID, ii, EVENT_NOTE_GENERATED))
            ii += 1
        od
        turnoff
    endin
    scoreline_i(sprintf("i \"Preallocate_%d\" 0 -1", INSTRUMENT_ID))
#endif

//----------------------------------------------------------------------------------------------------------------------
