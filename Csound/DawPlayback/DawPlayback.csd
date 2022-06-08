#include "definitions.h"

<CsoundSynthesizer>
<CsOptions>

--messagelevel=0
; --messagelevel=134
--midi-device=0
--nodisplays
-+rtmidi=null

#if ${BUILD_MIXDOWN_CSD}
;--nosound
#else
--nosound
#endif

</CsOptions>
<CsInstruments>

giPresetUuidPreallocationCount[] = fillarray( \
    5,  /* instr 4  -- 00: Kick 1 */ \
    6,  /* instr 5  -- 01: Kick 2: Left */ \
    6,  /* instr 6  -- 02: Kick 2: Right */ \
    4,  /* instr 7  -- 03: Snare */ \
    5,  /* instr 8  -- 04: HiHat 1 */ \
    7,  /* instr 9  -- 05: HiHat 2 */ \
    5,  /* instr 10 -- 06: Beacon */ \
    4,  /* instr 11 -- 07: Bass 1+2: Edited */ \
    4,  /* instr 12 -- 08: Bass 1+2: Distant */ \
    0   /* dummy */ \
)

${CSOUND_IFNDEF} OUTPUT_CHANNEL_COUNT
${CSOUND_DEFINE} OUTPUT_CHANNEL_COUNT #2#
${CSOUND_ENDIF}

${CSOUND_IFNDEF} INTERNAL_CHANNEL_COUNT
${CSOUND_DEFINE} INTERNAL_CHANNEL_COUNT #6#
${CSOUND_ENDIF}

sr = 48000
kr = 200
nchnls = $OUTPUT_CHANNEL_COUNT
0dbfs = 1

#define Init_instrnum 2
#define ClearSignals_instrnum 3

#include "_.mode3_TrackDefines.h"

${CSOUND_DEFINE} INSTANCE_NAME #"TestSynth playback"#
${CSOUND_INCLUDE} "af_global.orc"

#define LOW_CHANNEL_COUNT_INDEX 0
#define HIGH_CHANNEL_COUNT_INDEX 1

#if ${BUILD_MIXDOWN_CSD}
    ${CSOUND_DEFINE} DISTANCE_DELAY_SYNTH_NOTE_CACHE_ARRAY #fillarray 0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75, 76, 77, 78, 79, 80, 81, 82, 83, 84, 85, 86, 87, 88, 89, 90, 91, 92, 93, 94, 95, 96, 97, 98, 99, 100, 101, 102, 103, 104, 105, 106, 107, 108, 109, 110, 111, 112, 113, 114, 115, 116, 117, 118, 119, 120, 121, 122, 123, 124, 125, 126, 127#
#endif

gi_instrumentCount = 1
gi_instrumentIndexOffset = 0
gaInstrumentSignals[][] init gi_instrumentCount, $INTERNAL_CHANNEL_COUNT

gi_auxCount = 1
gi_auxIndexOffset = 0
giAuxChannelIndexRanges[][][] init gi_auxCount, gi_instrumentCount, 2 // 3rd column contains { [0]: low index, [1]: high index }
ga_auxVolumes[][][] init gi_auxCount, gi_instrumentCount, $INTERNAL_CHANNEL_COUNT
ga_auxSignals[][] init gi_auxCount, $INTERNAL_CHANNEL_COUNT

gi_trackCount = gi_instrumentCount + gi_auxCount
giMasterChannelIndexRanges[][] init gi_trackCount, 2 // 2nd column contains { [0]: low index, [1]: high index }
ga_masterVolumes[][] init gi_trackCount, $INTERNAL_CHANNEL_COUNT
ga_masterSignals[] init $INTERNAL_CHANNEL_COUNT

gkPlaybackTimeInSeconds init 0

// Initialize all vco2 tables so they don't get initialized during real-time performance and cause xruns on Quest 2.
iDummy = vco2init(31)

chn_k("main-volume", 1, 2, 1, 0, 1)
chn_k("pause", 1)

instr 1
    AF_3D_UpdateListenerRotationMatrix()
    AF_3D_UpdateListenerPosition()

    iSecondsPerKPass = 1 / kr
    gkPlaybackTimeInSeconds += iSecondsPerKPass
endin


instr Init_instrnum
    gi_instrumentCount = p4
    gi_instrumentIndexOffset = p5
    gi_auxCount = p6
    gi_auxIndexOffset = p7
    gi_trackCount = gi_instrumentCount + gi_auxCount

    a_instrumentSignals[][] init gi_instrumentCount, $INTERNAL_CHANNEL_COUNT
    gaInstrumentSignals = a_instrumentSignals

    // TODO: Make the DAW service set these using score lines.
    iAuxChannelIndexRanges[][][] init gi_auxCount, gi_instrumentCount, 2
    iI = 0
    while (iI < gi_auxCount) do
        iJ = 0
        while (iJ < gi_instrumentCount) do
            iAuxChannelIndexRanges[iI][iJ][LOW_CHANNEL_COUNT_INDEX] = 0
            iAuxChannelIndexRanges[iI][iJ][HIGH_CHANNEL_COUNT_INDEX] = $INTERNAL_CHANNEL_COUNT - 1
            iJ += 1
        od
        iI += 1
    od
    giAuxChannelIndexRanges = iAuxChannelIndexRanges

    a_auxVolumes[][][] init gi_auxCount, gi_instrumentCount, $INTERNAL_CHANNEL_COUNT
    ga_auxVolumes = a_auxVolumes

    a_auxSignals[][] init gi_auxCount, $INTERNAL_CHANNEL_COUNT
    ga_auxSignals = a_auxSignals


    // TODO: Make the DAW service set these using score lines.
    iMasterChannelIndexRanges[][] init gi_trackCount, 2
    iI = 0
    while (iI < gi_trackCount) do
        iMasterChannelIndexRanges[iI][LOW_CHANNEL_COUNT_INDEX] = 0
        iMasterChannelIndexRanges[iI][HIGH_CHANNEL_COUNT_INDEX] = $INTERNAL_CHANNEL_COUNT - 1
        iI += 1
    od
    giMasterChannelIndexRanges = iMasterChannelIndexRanges

    a_masterVolumes[][] init gi_trackCount, $INTERNAL_CHANNEL_COUNT
    ga_masterVolumes = a_masterVolumes

    a_masterSignals[] init $INTERNAL_CHANNEL_COUNT
    ga_masterSignals = a_masterSignals

    event_i("i", ClearSignals_instrnum, 0, -1)      // clear signals
    event_i("i", AuxMixInstrument, 1, -1) // mix instruments into auxes
    event_i("i", FinalMixInstrument, 1, -1)   // mix signals

    turnoff
endin


// Clear signals instrument. All included instruments should have instrument numbers higher than this instrument.
//
instr ClearSignals_instrnum
    gk_i += 1

    k_instrument = 0
    while (k_instrument < gi_instrumentCount) do
        k_channel = 0
        while (k_channel < $INTERNAL_CHANNEL_COUNT) do
            gaInstrumentSignals[k_instrument][k_channel] = 0
            k_channel += 1
        od
        k_instrument += 1
    od

    k_bus = 0
    while (k_bus < gi_auxCount) do
        k_channel = 0
        while (k_channel < $INTERNAL_CHANNEL_COUNT) do
            ga_auxSignals[k_bus][k_channel] = 0
            k_channel += 1
        od
        k_bus += 1
    od

    k_channel = 0
    while (k_channel < $INTERNAL_CHANNEL_COUNT) do
        ga_masterSignals[k_channel] = 0
        k_channel += 1
    od
endin


${CSOUND_IFDEF} IS_GENERATING_JSON
    giWriteComma init false
    gSPluginUuids[][] init TRACK_COUNT_MAX, PLUGIN_COUNT_MAX

    opcode setPluginUuid, 0, iiS
        iTrackIndex, iPluginIndex, SUuid xin
        ; if (iPluginIndex > 0 && strlen(gSPluginUuids[iTrackIndex][iPluginIndex]) == 0) then
        ;     gSPluginUuids[iTrackIndex][iPluginIndex] = "bus-head"
        ; endif
        gSPluginUuids[iTrackIndex][iPluginIndex] = SUuid
    endop

    instr StartJsonArray
        turnoff
        fprints("DawPlayback.json", "[")
    endin

    instr EndJsonArray
        turnoff
        fprints("DawPlayback.json", "]")
    endin

    instr StartJsonObject
        turnoff
        fprints("DawPlayback.json", "{")
    endin

    instr EndJsonObject
        turnoff
        fprints("DawPlayback.json", "}")
    endin

    instr GeneratePluginJson
        turnoff
        SPluginUuid = strget(p4)

        if (giWriteComma == true) then
            fprints("DawPlayback.json", ",")
        else
            giWriteComma = true
        endif

        fprints("DawPlayback.json", sprintf("\"%s\":[", SPluginUuid))

        iI = 0
        iWriteComma = false

        while (true == true) do
            SFileName = sprintf("json/%s.%d.json", SPluginUuid, iI)

            iLineNumber = 0
            while (iLineNumber != -1) do
                // Csound will delete this instrument if the given file doesn't exist.
                SLine, iLineNumber readfi SFileName

                if (iLineNumber == -1) then
                    log_i_debug("%s - done", SFileName)
                else

                    // A comma isn't needed if the file doesn't exist so we wait to write the comma after Csound is given a
                    // chance to delete this instrument if the file doesn't exist.
                    if (iWriteComma == true) then
                        fprints("DawPlayback.json", ",")
                    else
                        iWriteComma = true
                    endif

                    // Remove trailing newline.
                    if (strcmp(strsub(SLine, strlen(SLine) - 1, strlen(SLine)), "\n") == 0) then
                        SLine = strsub(SLine, 0, strlen(SLine) - 1)
                    endif

                    // Workaround Csound readfi opcode bug duplicating first character of each line after first line.
                    if (iLineNumber > 1) then
                        SLine = strsub(SLine, 1, strlen(SLine))
                    endif

                    fprints("DawPlayback.json", SLine)
                    log_i_debug("%s(%d): %s", SFileName, iLineNumber, SLine)
                endif
            od

            iI += 1
        od
    endin

    instr GenerateJson
        prints("instr GenerateJson ...\n")

        scoreline_i("i \"StartJsonObject\" 0 0")
        iI = 0
        while (iI < TRACK_COUNT_MAX) do
            if (strlen(gSPluginUuids[iI][0]) == 32) then // 32 == UUID length (without dashes)
                scoreline_i(sprintf("i \"GeneratePluginJson\" 0 0 \"%s\"", gSPluginUuids[iI][0]))
                scoreline_i("i \"EndJsonArray\" 0 0")
            endif
            iI += 1
        od
        scoreline_i("i \"EndJsonObject\" 0 0")

        prints("instr GenerateJson - done\n")
    endin
${CSOUND_ENDIF}


#define IS_PLAYBACK 1
${CSOUND_DEFINE} CSOUND_IS_PLAYBACK #1#
#include "_.mode3_TrackSet.orc"


// Aux mixer instrument.
// All included instruments should have instrument numbers lower than this instrument.
// All aux instruments should have instrument numbers higher than this instrument.
//
instr AuxMixInstrument
    // Mix instruments into auxes.
    kAux = 0
    while (kAux < gi_auxCount) do
        kInstrument = 0
        while (kInstrument < gi_instrumentCount) do
            kChannel = giAuxChannelIndexRanges[kAux][kInstrument][LOW_CHANNEL_COUNT_INDEX]
            kMaxChannel = giAuxChannelIndexRanges[kAux][kInstrument][HIGH_CHANNEL_COUNT_INDEX]
            while (kChannel <= kMaxChannel) do
                ga_auxSignals[kAux][kChannel] = ga_auxSignals[kAux][kChannel] +
                    ga_auxVolumes[kAux][kInstrument][kChannel] * gaInstrumentSignals[kInstrument][kChannel]
                kChannel += 1
            od
            kInstrument += 1
        od
        kAux += 1
    od
endin


// Controls track volumes sent to Aux tracks.
instr AuxInstrument
    k_aux = p4 - gi_auxIndexOffset
    k_track = p5 - gi_instrumentIndexOffset
    k_channel = p6
    k_volume = p7
    ga_auxVolumes[k_aux][k_track][k_channel] = k_volume
    turnoff
endin


// Controls track volumes sent to Master.
instr MasterInstrument
    k_track = p4 - gi_instrumentIndexOffset
    k_channel = p5
    k_volume = p6
    ga_masterVolumes[k_track][k_channel] = k_volume
    turnoff
endin


// Mixer instrument. All included instruments should have instrument numbers lower than this instrument.
//
instr FinalMixInstrument
    kChannel = 0
    while (kChannel < $INTERNAL_CHANNEL_COUNT) do
        ga_masterSignals[kChannel] = 0
        kChannel += 1
    od

    // Mix instrument tracks into master.
    kTrack = 0
    while (kTrack < gi_instrumentCount) do
        kChannel = giMasterChannelIndexRanges[kTrack][LOW_CHANNEL_COUNT_INDEX]
        kChannelHigh = giMasterChannelIndexRanges[kTrack][HIGH_CHANNEL_COUNT_INDEX]
        while (kChannel <= kChannelHigh) do
            ga_masterSignals[kChannel] = ga_masterSignals[kChannel] + gaInstrumentSignals[kTrack][kChannel] *
                ga_masterVolumes[kTrack][kChannel]
            kChannel += 1
        od
        kTrack += 1
    od

    // Mix aux tracks into master.
    // NB: 'kTrack' is not reset before entering the next loop. This is intentional.
    kAux = 0
    while (kAux < gi_auxCount) do
        kChannel = giMasterChannelIndexRanges[kTrack][LOW_CHANNEL_COUNT_INDEX]
        kChannelHigh = giMasterChannelIndexRanges[kTrack][HIGH_CHANNEL_COUNT_INDEX]
        while (kChannel <= kChannelHigh) do
            ga_masterSignals[kChannel] = ga_masterSignals[kChannel] + ga_auxSignals[kAux][kChannel] *
                ga_masterVolumes[kTrack][kChannel]
            kChannel += 1
        od
        kTrack += 1
        kAux += 1
    od

    // Use Omnitone sh_hrir_order_1.wav data tables to convert/convolve ambisonic output into stereo.
    aw = ga_masterSignals[0]
    ay = ga_masterSignals[1]
    az = ga_masterSignals[2]
    ax = ga_masterSignals[3]
    am0 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[0]), $AF_3D_LISTENER_LAG_TIME)
    am1 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[1]), $AF_3D_LISTENER_LAG_TIME)
    am2 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[2]), $AF_3D_LISTENER_LAG_TIME)
    am3 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[3]), $AF_3D_LISTENER_LAG_TIME)
    am4 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[4]), $AF_3D_LISTENER_LAG_TIME)
    am5 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[5]), $AF_3D_LISTENER_LAG_TIME)
    am6 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[6]), $AF_3D_LISTENER_LAG_TIME)
    am7 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[7]), $AF_3D_LISTENER_LAG_TIME)
    am8 = lag:a(a(gk_AF_3D_ListenerRotationMatrix[8]), $AF_3D_LISTENER_LAG_TIME)
    ayr = -(ay * am0 + az * am3 + ax * am6)
    azr =   ay * am1 + az * am4 + ax * am7
    axr = -(ay * am2 + az * am5 + ax * am8)
    iHrirLength = ftlen(gi_AF_3D_HrirChannel1TableNumber)
    aw ftconv aw, gi_AF_3D_HrirChannel1TableNumber, iHrirLength
    ay ftconv ayr, gi_AF_3D_HrirChannel2TableNumber, iHrirLength
    az ftconv azr, gi_AF_3D_HrirChannel3TableNumber, iHrirLength
    ax ftconv axr, gi_AF_3D_HrirChannel4TableNumber, iHrirLength
    aL = aw + ay + az + ax
    aR = aw - ay + az + ax

    // Add reverb.
    aL += ga_masterSignals[4]
    aR += ga_masterSignals[5]

    kMainVolume init 1
    kPaused init false
    kPause = chnget:k("pause")
    if (kPause == true && kPaused == false) then
        kMainVolume = 0
        kPaused = true
        printsk("csd:paused at %.3f\n", timeinsts())
    elseif (kPause == false && kPaused == true) then
        kMainVolume = 1
        kPaused = false
        printsk("csd:resumed at %.3f\n", timeinsts())
    endif
    aMainVolume = lag:a(a(kMainVolume), 0.05)
    outs(aL * aMainVolume, aR * aMainVolume)
endin


instr EndOfInstrumentAllocations
    // If you see instrument allocation messages like `new alloc for instr 8:` after this message is printed, slower
    // devices like the Oculus Quest 2 will hit buffer underruns.
    prints("-------------------------------------------------------------------------------------------------------\n")
    prints("Add preallocation score lines for all instruments allocated after this message.\n")
    prints("-------------------------------------------------------------------------------------------------------\n")
    turnoff
endin


instr SendStartupMessage
    // If the duration is not -1 then this is the preallocation instance of this instrument.
    if (p3 == -1) then
        prints("csd:started at %.3f\n", times())
    endif
    turnoff
endin


instr SendEndedMessage
    // If the duration is not -1 then this is the preallocation instance of this instrument.
    if (p3 == -1) then
        prints("csd:ended\n")
    endif
    turnoff
endin


instr SetMixdownListenerPosition
    iTableNumber init 1
    // { position: new BABYLON.Vector3(0, 2, 250), target: new BABYLON.Vector3(0, 125, 0) }
    tablew(  -1,                   0, iTableNumber)
    tablew(   0,                   1, iTableNumber)
    tablew(   0,                   2, iTableNumber)
    tablew(   0,                   3, iTableNumber)
    tablew(   0,                   4, iTableNumber)
    tablew(   0.8972800970077515,  5, iTableNumber)
    tablew(   0.4414618015289306,  6, iTableNumber)
    tablew(   0,                   7, iTableNumber)
    tablew(   0,                   8, iTableNumber)
    tablew(   0.4414618015289306,  9, iTableNumber)
    tablew(  -0.8972800970077515, 10, iTableNumber)
    tablew(   0,                  11, iTableNumber)
    tablew(   0,                  12, iTableNumber)
    tablew(   2,                  13, iTableNumber)
    tablew( 250,                  14, iTableNumber)
    tablew(   1,                  15, iTableNumber)
    turnoff
endin


</CsInstruments>
<CsScore>

${CSOUND_IFNDEF} SCORE_START_DELAY
    ${CSOUND_DEFINE} SCORE_START_DELAY #3.5#
${CSOUND_ENDIF}

#define Cc _(EVENT_CC)
#define NoteOn -1 _(EVENT_NOTE_ON)
#define NoteOff 0

#define Aux(x) x
#define AuxCount(x) x
#define AuxIndexOffset(x) x
#define CC_Value(x) x
#define Channel(x) x
#define InstrumentCount(x) x
#define InstrumentIndexOffset(x) x
#define Note(x) x
#define Track(x) x
#define Unused(x)
#define Velocity(x) x
#define Volume(x) x

i 1 0 -1
i "SendEndedMessage" 0 1 // preallocation instance

${CSOUND_IFDEF} IS_MIXDOWN
    i "SetMixdownListenerPosition" 1 -1
${CSOUND_ENDIF}

#include "_.mode3_TrackSet.sco"
#include "_.mode3.sco"
#include "_.mode4.sco"

s
; Allow time for the reverb tail to fade out and the camera animation speed to slow down to zero.
i "SendEndedMessage" 30 -1

${CSOUND_IFDEF} IS_GENERATING_JSON
    i "GenerateJson" 0 1
${CSOUND_ELSE}
    ; Allow time to rewind the score. Csound will error out if the score times out before it is rewound.
    e 60
${CSOUND_ENDIF}

</CsScore>
</CsoundSynthesizer>
<Cabbage>
</Cabbage>
