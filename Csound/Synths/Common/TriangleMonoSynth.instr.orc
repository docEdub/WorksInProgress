
${CSOUND_IFNDEF} TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
${CSOUND_DEFINE} TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime #0.05#
${CSOUND_ENDIF}

${CSOUND_IFNDEF} TriangleMonoSynth_NoteNumberPortamentoTime
${CSOUND_DEFINE} TriangleMonoSynth_NoteNumberPortamentoTime #0.01#
${CSOUND_ENDIF}


${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr CONCAT(INSTRUMENT_ID, _Json)
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
        gk${InstrumentName}_NoteNumber[ORC_INSTANCE_INDEX] = iNoteNumber

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i("i \"${InstrumentName}_Json\" 0 0")
            endif
            gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] = gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] + 1
            SJsonFile = sprintf("json/%s.%d.json",
                INSTRUMENT_PLUGIN_UUID,
                gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX])
            fprints(SJsonFile, "{\"noteOn\":{\"time\":%.3f}}", times())
            ficlose(SJsonFile)
        ${CSOUND_ENDIF}
    endif
end:
endin


instr CONCAT(INSTRUMENT_ID, _MonoHandler)
    log_i_trace("%s ...", nstrstr(p1))

    setksmps(1)

    iOrcInstanceIndex = ORC_INSTANCE_INDEX
    iAmp = 0.4
    aOut = 0
    a1 = 0
    a2 = 0
    a3 = 0
    a4 = 0

    iVolumeEnvelopeSlope = giSecondsPerSample / $TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
    kVolumeEnvelopeModifier init 0
    kActiveNoteCount = active:k(nstrnum(STRINGIZE(INSTRUMENT_ID)))
    if (kActiveNoteCount > 0 && changed2(gk_playing) == true && gk_playing == false) then
        log_k_trace("Turning off %d active notes", kActiveNoteCount)
        turnoff2(nstrnum(STRINGIZE(INSTRUMENT_ID)), 0, 0)
        kActiveNoteCount = 0
    endif
    kActiveNoteCountPrevious init 0
    kNoteNumberWhenActivated init 0
    kActiveNoteCountChanged = false
    kNoteNumberNeedsPortamento init false
    if (changed2(kActiveNoteCount) == true || kActiveNoteCountPrevious == 0) then
        ; log_k_trace("%s: kActiveNoteCount changed to %d", nstrstr(p1), kActiveNoteCount)
        if (kActiveNoteCount == 1 && kActiveNoteCountPrevious == 0) then
            ; log_k_trace("Attack started")
            kNoteNumberWhenActivated = gk${InstrumentName}_NoteNumber[ORC_INSTANCE_INDEX]
            kActiveNoteCountChanged = true
            kNoteNumberNeedsPortamento = false
            kVolumeEnvelopeModifier = iVolumeEnvelopeSlope
        elseif (kActiveNoteCount == 0) then
            ; log_k_trace("Decay started")
            kVolumeEnvelopeModifier = -iVolumeEnvelopeSlope
        endif
        kActiveNoteCountPrevious = kActiveNoteCount
    endif

    kVolumeEnvelope init 0
    kVolumeEnvelope += kVolumeEnvelopeModifier
    if (kVolumeEnvelope < 0) then
        kVolumeEnvelope = 0
        kVolumeEnvelopeModifier = 0
    elseif (kVolumeEnvelope > 1) then
        kVolumeEnvelope = 1
        kVolumeEnvelopeModifier = 0
    endif
    if (kVolumeEnvelope == 0) then
        if (kActiveNoteCount == 0) then
            log_k_trace("Deactivating mono handler instrument")
            turnoff
        endif
        kgoto end
    endif

    kNoteNumber init 0
    kCurrentNoteNumber = gk${InstrumentName}_NoteNumber[ORC_INSTANCE_INDEX]
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
        kNoteNumberPortamentoTime = $TriangleMonoSynth_NoteNumberPortamentoTime
    endif
    kNoteNumber = portk(kCurrentNoteNumber, kNoteNumberPortamentoTime)

    kCps = cpsmidinn(kNoteNumber)
    aOut = vco2(iAmp, kCps, VCO2_WAVEFORM_TRIANGLE_NO_RAMP)
    aOut *= kVolumeEnvelope

    if (CC_VALUE_k(positionEnabled) == true) then
        #include "../Position_kXYZ.orc"

        iScaleFactorX = random:i(-20, 20)
        kX *= iScaleFactorX

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
