// Mesh geometry generated in Javascript.
#if IS_PLAYBACK
    gi${InstrumentName}_MeshSegmentCount init _($){${RimMesh}.segments}
    gi${InstrumentName}_MeshRowCount init _($){${RimMesh}.rows}
    gi${InstrumentName}_MeshAudioPositions[] init _($){${RimMesh}.audioPositionsString}
#else
    gi${InstrumentName}_MeshSegmentCount init 1
    gi${InstrumentName}_MeshRowCount init 1
    gi${InstrumentName}_MeshAudioPositions[] init 1 // [segment, row, xyz]

    instr ${InstrumentName}_MeshSegmentCount
        if (gi${InstrumentName}_MeshSegmentCount != p4) then
            gi${InstrumentName}_MeshSegmentCount = p4
            iMeshAudioPositions[] init gi${InstrumentName}_MeshSegmentCount * gi${InstrumentName}_MeshRowCount * 3
            gi${InstrumentName}_MeshAudioPositions = iMeshAudioPositions
        endif
        turnoff
    endin

    instr ${InstrumentName}_MeshRowCount
        if (gi${InstrumentName}_MeshRowCount != p4) then
            gi${InstrumentName}_MeshRowCount = p4
            iMeshAudioPositions[] init gi${InstrumentName}_MeshSegmentCount * gi${InstrumentName}_MeshRowCount * 3
            gi${InstrumentName}_MeshAudioPositions = iMeshAudioPositions
        endif
        turnoff
    endin

    instr ${InstrumentName}_MeshAudioPosition
        iIndex = p4
        iX = p5
        iY = p6
        iZ = p7
        log_i_trace(
            "instr ${InstrumentName}_MeshAudioPositions: iSegment = %d, iRow = %d, iX = %.3f, iY = %.3f, iZ = %.3f",
            iIndex % gi${InstrumentName}_MeshSegmentCount,
            floor(iIndex / gi${InstrumentName}_MeshSegmentCount),
            iX,
            iY,
            iZ)
        if (iIndex < gi${InstrumentName}_MeshSegmentCount * gi${InstrumentName}_MeshRowCount) then
            iIndex *= 3
            gi${InstrumentName}_MeshAudioPositions[iIndex] = iX
            gi${InstrumentName}_MeshAudioPositions[iIndex + 1] = iY
            gi${InstrumentName}_MeshAudioPositions[iIndex + 2] = iZ
        endif
        turnoff
    endin

    instr ${InstrumentName}_MeshSegmentCountString
        SCount init "0"
        SCount = strget(p4)
        iCount = strtod(SCount)
        scoreline_i(sprintf("i\"${InstrumentName}_MeshSegmentCount\" 0 1 %d", iCount))
        turnoff
    endin

    instr ${InstrumentName}_MeshRowCountString
        SCount init "0"
        SCount = strget(p4)
        iCount = strtod(SCount)
        scoreline_i(sprintf("i\"${InstrumentName}_MeshRowCount\" 0 1 %d", iCount))
        turnoff
    endin

    instr ${InstrumentName}_MeshAudioPositionString
        SArgs[] = string_split_i(strget(p4), "/")
        iInstrumentNumber = nstrnum("${InstrumentName}_MeshAudioPosition") + frac(p1)
        scoreline_i(sprintf("i%f 0 1 %s %s %s %s", iInstrumentNumber, SArgs[0], SArgs[1], SArgs[2], SArgs[3]))
        turnoff
    endin

    instr ${InstrumentName}_MeshJavascriptOscHandler
        if (gi_oscHandle == -1) then
            // Restart this instrument to see if the OSC handle has been set, yet.
            log_i_trace("OSC not initialized. Restarting instrument in 1 second.")
            event("i", p1, 1, -1)
            turnoff
        else
            log_i_trace("Listening for geometry Javascript OSC messages on port %d.", gi_oscPort)

            SMeshSegmentCount init "0"
            kReceived = OSClisten(
                gi_oscHandle,
                sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "MeshSegmentCount"),
                "s",
                SMeshSegmentCount)
            if (kReceived == true) then
                log_k_debug("MeshSegmentCount = %s", SMeshSegmentCount)
                scoreline(sprintfk("i\"${InstrumentName}_MeshSegmentCountString\" 0 1 \"%s\"", SMeshSegmentCount), 1)
            endif

            SMeshRowCount init "0"
            kReceived = OSClisten(
                gi_oscHandle,
                sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "MeshRowCount"),
                "s",
                SMeshRowCount)
            if (kReceived == true) then
                log_k_debug("MeshRowCount = %s", SMeshRowCount)
                scoreline(sprintfk("i\"${InstrumentName}_MeshRowCountString\" 0 1 \"%s\"", SMeshRowCount), 1)
            endif

            SMeshAudioPosition init "0"
            kReceived = true
            iMeshAudioPositionStringInstrumentNumber = nstrnum("${InstrumentName}_MeshAudioPositionString")
            kInstrumentNumberFraction = 1
            while (kReceived == true) do
                kReceived = OSClisten(
                    gi_oscHandle,
                    sprintfk("%s/%s", TRACK_OSC_JAVASCRIPT_SCORE_LINE_PATH, "MeshAudioPosition"),
                    "s",
                    SMeshAudioPosition)
                if (kReceived == true) then
                    ; log_k_debug("MeshAudioPosition = %s", SMeshAudioPosition)
                    scoreline(
                        sprintfk("i%d.%05d 0 1 \"%s\"",
                            iMeshAudioPositionStringInstrumentNumber,
                            kInstrumentNumberFraction,
                            SMeshAudioPosition),
                        1)
                endif
                kInstrumentNumberFraction += 1
            od
        endif
    endin
    scoreline_i("i \"${InstrumentName}_MeshJavascriptOscHandler\" 0 -1")
#endif
