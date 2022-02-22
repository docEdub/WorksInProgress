
${CSOUND_IFNDEF} TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
${CSOUND_DEFINE} TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime #0.05#
${CSOUND_ENDIF}

${CSOUND_IFNDEF} TriangleMonoSynth_NoteNumberPortamentoTime
${CSOUND_DEFINE} TriangleMonoSynth_NoteNumberPortamentoTime #0.01#
${CSOUND_ENDIF}

${CSOUND_IFNDEF} TriangleMonoSynth_VcoBandwith
${CSOUND_DEFINE} TriangleMonoSynth_VcoBandwith #0.5#
${CSOUND_ENDIF}


${CSOUND_IFDEF} IS_GENERATING_JSON
    setPluginUuid(INSTRUMENT_TRACK_INDEX, INSTRUMENT_PLUGIN_INDEX, INSTRUMENT_PLUGIN_UUID)

    instr CONCAT(Json_, INSTRUMENT_ID)
        SJsonFile = sprintf("json/%s.0.json", INSTRUMENT_PLUGIN_UUID)
        fprints(SJsonFile, "{")
        fprints(SJsonFile, sprintf("\"instanceName\":\"%s\"", INSTANCE_NAME))
        fprints(SJsonFile, "}")
        turnoff
    endin

    instr CONCAT(JsonAppend_, INSTRUMENT_ID)
        gS${InstrumentName}_Json[ORC_INSTANCE_INDEX] = strcat(gS${InstrumentName}_Json[ORC_INSTANCE_INDEX], strget(p4))
        ; prints("%s\n", gS${InstrumentName}_Json[ORC_INSTANCE_INDEX])
        turnoff
    endin

    instr CONCAT(JsonWrite_, INSTRUMENT_ID)
        SJsonFile = sprintf("json/%s.%d.json",
            INSTRUMENT_PLUGIN_UUID,
            gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX])

        // Print to file in 100 character blocks so Csound doesn't crash.
        iStringLength = strlen(gS${InstrumentName}_Json[ORC_INSTANCE_INDEX])
        ii = 0
        while (ii < iStringLength / 100) do
            fprints(SJsonFile, strsub(gS${InstrumentName}_Json[ORC_INSTANCE_INDEX], 100 * ii, 100 * ii + 100))
            ii += 1
        od
        if (100 * ii < iStringLength) then
            fprints(SJsonFile, strsub(gS${InstrumentName}_Json[ORC_INSTANCE_INDEX], 100 * ii, iStringLength))
        endif

        fprints(SJsonFile, "]}}")
        ficlose(SJsonFile)
        gS${InstrumentName}_Json[ORC_INSTANCE_INDEX] = ""
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
    elseif (iEventType == EVENT_NOTE_OFF) then
        gk${InstrumentName}_ActiveNoteCount[ORC_INSTANCE_INDEX] =
            gk${InstrumentName}_ActiveNoteCount[ORC_INSTANCE_INDEX] - 1
            log_k_trace("Off: active note count = %d", gk${InstrumentName}_ActiveNoteCount[ORC_INSTANCE_INDEX])
        turnoff
    elseif (iEventType == EVENT_NOTE_ON) then
        iNoteNumber = p5
        iVelocity = p6

        kActiveNoteCountIncremented init false
        if (kActiveNoteCountIncremented == false) then
            gk${InstrumentName}_ActiveNoteCount[ORC_INSTANCE_INDEX] =
                gk${InstrumentName}_ActiveNoteCount[ORC_INSTANCE_INDEX] + 1
            kActiveNoteCountIncremented = true
            log_k_trace("On : active note count = %d", gk${InstrumentName}_ActiveNoteCount[ORC_INSTANCE_INDEX])
        endif
        xtratim(1 / kr)
        kReleased = release()
        if (kReleased == true) then
            event("i", int(p1), 0, 1, EVENT_NOTE_OFF, 0, 0)
            turnoff
        endif

        if (gi${InstrumentName}_MonoHandlerIsActive[ORC_INSTANCE_INDEX] == false) then
            log_i_trace("Activating mono handler instrument")
            event_i("i", int(p1) + .9999 , 0, -1, EVENT_NOTE_MONO_HANDLER_ON, 0, 0)
        endif
        gk${InstrumentName}_NoteNumber[ORC_INSTANCE_INDEX] = iNoteNumber
    elseif (iEventType == EVENT_NOTE_MONO_HANDLER_OFF) then
        gi${InstrumentName}_MonoHandlerIsActive[ORC_INSTANCE_INDEX] = false

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            event_i("i", STRINGIZE(CONCAT(JsonWrite_, INSTRUMENT_ID)), 0, -1)
        ${CSOUND_ENDIF}

        turnoff
    elseif (iEventType == EVENT_NOTE_MONO_HANDLER_ON) then
        gi${InstrumentName}_MonoHandlerIsActive[ORC_INSTANCE_INDEX] = true
        iOrcInstanceIndex = ORC_INSTANCE_INDEX
        iAmp = 0.4
        aOut = 0
        a1 = 0
        a2 = 0
        a3 = 0
        a4 = 0

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            if (gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] == 0) then
                scoreline_i(sprintf("i \"%s\" 0 0", STRINGIZE(CONCAT(Json_, INSTRUMENT_ID))))
            endif
            gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] = gi${InstrumentName}_NoteIndex[ORC_INSTANCE_INDEX] + 1
            iStartTime = times()
            kTime = (times:k() - 1 / kr) - iStartTime
            SiJson = sprintf("{\"noteOn\":{\"time\":%.3f", iStartTime)
            SiJson = strcat(SiJson, ",\"k\":[")
            scoreline_i(sprintf("i \"%s\" 0 -1 \"%s\"", STRINGIZE(CONCAT(JsonAppend_, INSTRUMENT_ID)), string_escape_i(SiJson)))
        ${CSOUND_ENDIF}

        iVolumeEnvelopeSlope = giSecondsPerSample / $TriangleMonoSynth_VolumeEnvelopeAttackAndDecayTime
        kVolumeEnvelopeModifier init 0
        kActiveNoteCount = gk${InstrumentName}_ActiveNoteCount[ORC_INSTANCE_INDEX]
        #if !IS_PLAYBACK
            if (changed2(gk_playing) == true && gk_playing == false) then
                event("i", int(p1), 0, 1, EVENT_NOTE_MONO_HANDLER_OFF, 0, 0)
                log_k_trace("Turning off %d active notes", kActiveNoteCount)
                turnoff2(nstrnum(STRINGIZE(INSTRUMENT_ID)), 0, 1)
                kActiveNoteCount = 0
            endif
        #endif
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

        aVolumeEnvelope init 0
        kVolumeEnvelope init 0
        if (kVolumeEnvelopeModifier == 0) then
            aVolumeEnvelope = kVolumeEnvelope
        else
            kI = 0
            while (kI < ksmps) do
                vaset(kVolumeEnvelope, kI, aVolumeEnvelope)
                kVolumeEnvelope += kVolumeEnvelopeModifier
                if (kVolumeEnvelope < 0) then
                    kVolumeEnvelope = 0
                    kVolumeEnvelopeModifier = 0
                elseif (kVolumeEnvelope > 1) then
                    kVolumeEnvelope = 1
                    kVolumeEnvelopeModifier = 0
                endif
                kI += 1
            od
        endif
        if (kVolumeEnvelope == 0) then
            if (kActiveNoteCount == 0) then
                log_k_trace("Deactivating mono handler instrument")
                event("i", int(p1), 0, 1, EVENT_NOTE_MONO_HANDLER_OFF, 0, 0)
                ${CSOUND_IFDEF} IS_GENERATING_JSON
                    SkJson = sprintfk(",{\"time\":%.3f,\"volume\":0}", kTime)
                    scoreline(sprintfk("i \"%s\" 0 -1 \"%s\"", STRINGIZE(CONCAT(JsonAppend_, INSTRUMENT_ID)), string_escape_k(SkJson)), k(1))
                ${CSOUND_ENDIF}
                turnoff
            endif
            kgoto end__mono_handler
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
        aOut = vco2(iAmp, kCps, VCO2_WAVEFORM_TRIANGLE_NO_RAMP, 0.5, 0, $TriangleMonoSynth_VcoBandwith)
        aOut *= aVolumeEnvelope

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
            a1 = aOut
            a2 = 0
            a3 = 0
            a4 = 0
        endif

        ${CSOUND_IFDEF} IS_GENERATING_JSON
            kJsonChanged_Any init true
            kJsonChanged_NoteNumber init true
            kJsonChanged_Volume init true
            kJsonChanged_X init true
            kJsonChanged_Y init true
            kJsonChanged_Z init true
            kJsonPrevious_NoteNumber init 0
            kJsonPrevious_Volume init 0
            kJsonPrevious_X init 0
            kJsonPrevious_Y init 0
            kJsonPrevious_Z init 0

            kNoteNumber_Rounded = round:k(kNoteNumber * 1000) / 1000
            kVolume_Rounded = round:k(kVolumeEnvelope * 1000) / 1000
            kX_Rounded = round:k(kX * 1000) / 1000
            kY_Rounded = round:k(kY * 1000) / 1000
            kZ_Rounded = round:k(kZ * 1000) / 1000

            kJsonFirstPass init true
            if (kJsonFirstPass == false) then
                kJsonChanged_Any = false
                kJsonChanged_NoteNumber = false
                kJsonChanged_Volume = false
                kJsonChanged_X = false
                kJsonChanged_Y = false
                kJsonChanged_Z = false
                if (kJsonPrevious_NoteNumber != kNoteNumber_Rounded) then
                    kJsonPrevious_NoteNumber = kNoteNumber_Rounded
                    kJsonChanged_Any = true
                    kJsonChanged_NoteNumber = true
                endif
                if (kJsonPrevious_Volume != kVolume_Rounded) then
                    kJsonPrevious_Volume = kVolume_Rounded
                    kJsonChanged_Any = true
                    kJsonChanged_Volume = true
                endif
                if (kJsonPrevious_X != kX_Rounded) then
                    kJsonPrevious_X = kX_Rounded
                    kJsonChanged_Any = true
                    kJsonChanged_X = true
                endif
                if (kJsonPrevious_Y != kY_Rounded) then
                    kJsonPrevious_Y = kY_Rounded
                    kJsonChanged_Any = true
                    kJsonChanged_Y = true
                endif
                if (kJsonPrevious_Z != kZ_Rounded) then
                    kJsonPrevious_Z = kZ_Rounded
                    kJsonChanged_Any = true
                    kJsonChanged_Z = true
                endif
            endif

            if (kJsonChanged_Any == true) then
                SkJson = sprintfk("%s", "")
                if (kJsonFirstPass == false) then
                    // Add a new line for each k-pass item so Csound's 8192 character line limit doesn't cause issues in
                    // the DawPlayback.csd's GeneratePluginJson instrument.
                    SkJson = strcatk(SkJson, "\n,")
                endif
                SkJson = strcatk(SkJson, "{")
                SkJson = strcatk(SkJson, sprintfk("\"time\":%.3f", kTime))
                if (kJsonChanged_NoteNumber == true) then
                    SkJson = strcatk(SkJson, sprintfk(",\"pitch\":%.3f", kNoteNumber_Rounded))
                endif
                if (kJsonChanged_Volume == true) then
                    SkJson = strcatk(SkJson, sprintfk(",\"volume\":%.3f", kVolume_Rounded))
                endif
                if (CC_VALUE_k(positionEnabled) == true) then
                    if (kJsonChanged_X == true) then
                        SkJson = strcatk(SkJson, sprintfk(",\"x\":%.3f", kX_Rounded))
                    endif
                    if (kJsonChanged_Y == true) then
                        SkJson = strcatk(SkJson, sprintfk(",\"y\":%.3f", kY_Rounded))
                    endif
                    if (kJsonChanged_Z == true) then
                        SkJson = strcatk(SkJson, sprintfk(",\"z\":%.3f", kZ_Rounded))
                    endif
                endif
                SkJson = strcatk(SkJson, "}")
                ; printsk("%s\n", SkJson)
                scoreline(sprintfk("i \"%s\" 0 -1 \"%s\"", STRINGIZE(CONCAT(JsonAppend_, INSTRUMENT_ID)), string_escape_k(SkJson)), k(1))
            endif

            kJsonFirstPass = false
        ${CSOUND_ENDIF}

    end__mono_handler:
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
                event("i", STRINGIZE(CONCAT(MonoHandler_, INSTRUMENT_ID)), 0, -1)
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
    endif
end:
endin

//----------------------------------------------------------------------------------------------------------------------
