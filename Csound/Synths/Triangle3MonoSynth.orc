#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Triangle3MonoSynth.orc
//
// Description:
//  Single triangle wave oscillator with mono-synth pitch and note on/off handling.
//----------------------------------------------------------------------------------------------------------------------

#ifndef INSTRUMENT_NAME
    #define INSTRUMENT_NAME ${InstrumentName}
#endif

#include "instrument_orc_definitions.h"
#include "Position_defines.h"


#ifndef Triangle3MonoSynth_orc__include_guard
#define Triangle3MonoSynth_orc__include_guard

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
${CSOUND_INCLUDE} "time.orc"

giTriangle3MonoSynth_VolumeEnvelopeAttackTime = 0.01
giTriangle3MonoSynth_MaxAmpWhenVeryClose = 1
giTriangle3MonoSynth_ReferenceDistance = 0.1
giTriangle3MonoSynth_RolloffFactor = 0.005
giTriangle3MonoSynth_PlaybackVolumeAdjustment = 0.9
giTriangle3MonoSynth_PlaybackReverbAdjustment = 1.5

giTriangle3MonoSynth_NoteIndex[] init ORC_INSTANCE_COUNT
gkTriangle3MonoSynth_NoteNumber[] init ORC_INSTANCE_COUNT

#endif // #ifndef Triangle3MonoSynth_orc__include_guard

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr Triangle3MonoSynth_Json
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
        iCcIndex = p5
        iCcValue = p6
        if (strcmp(gSCcInfo[iCcIndex][$CC_INFO_TYPE], "string") == 0) then
            gSCcValues[ORC_INSTANCE_INDEX][iCcIndex] = strget(iCcValue)
        else
            giCcValues[ORC_INSTANCE_INDEX][iCcIndex] = iCcValue
            gkCcValues[ORC_INSTANCE_INDEX][iCcIndex] = iCcValue
        endif
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        iNoteNumber = p5
        iVelocity = p6

        if (active:i(nstrnum(STRINGIZE(CONCAT(INSTRUMENT_ID, _MonoHandler)))) == 0) then
            log_i_trace("Activating mono handler instrument")
            event_i("i", STRINGIZE(CONCAT(INSTRUMENT_ID, _MonoHandler)), 0, -1)  
        endif
        gkTriangle3MonoSynth_NoteNumber[ORC_INSTANCE_INDEX] = iNoteNumber

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (giTriangle3MonoSynth_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"Triangle3MonoSynth_Json\" 0 0")
            endif
            giTriangle3MonoSynth_NoteIndex[ORC_INSTANCE_INDEX] = giTriangle3MonoSynth_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                giTriangle3MonoSynth_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f}}", times())
            ficlose(SJsonFile)
        ${CSOUND_ENDIF}
    endif
end:
endin


instr CONCAT(INSTRUMENT_ID, _MonoHandler)
    log_i_trace("%s ...", nstrstr(p1))

    iOrcInstanceIndex = ORC_INSTANCE_INDEX
    iAmp = 0.4
    aOut = 0
    a1 = 0
    a2 = 0
    a3 = 0
    a4 = 0

    iEnvelopeSlope = (1 / giTriangle3MonoSynth_VolumeEnvelopeAttackTime) / sr
    kEnvelopeModifier init 0
    kActiveNoteCount = active:k(nstrnum(STRINGIZE(INSTRUMENT_ID)))
    if (kActiveNoteCount > 0 && gk_playing == false) then
        log_k_trace("Turning off %d active notes", kActiveNoteCount)
        turnoff2(nstrnum(STRINGIZE(INSTRUMENT_ID)), 0, 0)
        kActiveNoteCount = 0
    endif
    kActiveNoteCountPrevious init 0
    kNoteNumberWhenActivated init 0
    kActiveNoteCountChanged = false
    kNoteNumberNeedsPortamento init false
    if (changed2(kActiveNoteCount) == true || kActiveNoteCountPrevious == 0) then
        log_k_trace("%s: kActiveNoteCount changed to %d", nstrstr(p1), kActiveNoteCount)
        if (kActiveNoteCount == 1 && kActiveNoteCountPrevious == 0) then
            log_k_trace("Attack started")
            kNoteNumberWhenActivated = gkTriangle3MonoSynth_NoteNumber[ORC_INSTANCE_INDEX]
            kActiveNoteCountChanged = true
            kNoteNumberNeedsPortamento = false
            kEnvelopeModifier = iEnvelopeSlope
        elseif (kActiveNoteCount == 0) then
            log_k_trace("Decay started")
            kEnvelopeModifier = -iEnvelopeSlope
        endif
        kActiveNoteCountPrevious = kActiveNoteCount
    endif

    kEnvelope init 0
    kEnvelope += kEnvelopeModifier
    if (kEnvelope < 0) then
        kEnvelope = 0
        kEnvelopeModifier = 0
    elseif (kEnvelope > 1) then
        kEnvelope = 1
        kEnvelopeModifier = 0
    endif
    if (kEnvelope == 0) then
        if (kActiveNoteCount == 0) then
            log_k_trace("Deactivating mono handler instrument")
            turnoff
        endif
        kgoto end
    endif

    kNoteNumber init 0
    kCurrentNoteNumber = gkTriangle3MonoSynth_NoteNumber[ORC_INSTANCE_INDEX]
    if (changed2(kCurrentNoteNumber) == true) then
        if (kActiveNoteCountChanged == false) then
            log_k_trace("Setting kNoteNumberNeedsPortamento to true")
            kNoteNumberNeedsPortamento = true
        endif
    endif
    kNoteNumberPortamentoTime init 0
    if (kNoteNumberNeedsPortamento == false) then
        kNoteNumberPortamentoTime = 0
    else
        kNoteNumberPortamentoTime = .01
    endif
    kNoteNumber = portk(kCurrentNoteNumber, kNoteNumberPortamentoTime)

    kCps = cpsmidinn(kNoteNumber)
    aOut = vco2(iAmp, kCps, VCO2_WAVEFORM_TRIANGLE_NO_RAMP)
    aOut *= kEnvelope

    if (CC_VALUE_k(positionEnabled) == true) then
        #include "Position_kXYZ.orc"

        #if LOGGING
            kLastTime init 0
            kTime = time_k()
            if (kTime - kLastTime > 0.1) then
                kLastTime = kTime
                ; log_k_trace("xz = (%.3f, %.3f)", kX, kZ)
                log_k_debug("time_PlaybackTime = %.3f", time_PlaybackTime:k())
            endif
        #endif

        kDistance = AF_3D_Audio_SourceDistance(kX, kY, kZ)
        kDistanceAmp = AF_3D_Audio_DistanceAttenuation(kDistance, kPositionReferenceDistance, kPositionRolloffFactor)
        aOut *= min(kDistanceAmp, kPositionMaxAmpWhenClose)

        AF_3D_Audio_ChannelGains_XYZ(kX, kY, kZ)
        a1 = gkAmbisonicChannelGains[0] * aOut
        a2 = gkAmbisonicChannelGains[1] * aOut
        a3 = gkAmbisonicChannelGains[2] * aOut
        a4 = gkAmbisonicChannelGains[3] * aOut
    else
        // Disabled.
        a1 = 0
        a2 = 0
        a3 = 0
        a4 = aOut
    endif

end:
    #if IS_PLAYBACK
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][0] = a1
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][1] = a2
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][2] = a3
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][3] = a4
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][4] = aOut
        gaInstrumentSignals[INSTRUMENT_TRACK_INDEX][5] = aOut
    #else
        outc(a1, a2, a3, a4, aOut, aOut)
    #endif

    #if !IS_PLAYBACK
        if (gkReloaded == true) then
            event("i", STRINGIZE(CONCAT(INSTRUMENT_ID, _MonoHandler)), 0, -1)
            turnoff
        endif
    #endif

    ; #if LOGGING
    ;     kLastTime init 0
    ;     kTime = time_k()
    ;     if (kTime - kLastTime > 1) then
    ;         kLastTime = kTime
    ;         log_k_trace("%s running ...", nstrstr(p1))
    ;     endif
    ; #endif

    log_i_trace("%s - done", nstrstr(p1))
endin

//----------------------------------------------------------------------------------------------------------------------
