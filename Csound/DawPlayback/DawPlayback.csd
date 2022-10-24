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
    4,  /* instr 13 -- 09: Rim 1: Hi Arp */ \
    5,  /* instr 14 -- 10: Rim 2: Hi Line */ \
    3,  /* instr 15 -- 11: Rim 3: Lo Line */ \
    6,  /* instr 16 -- 12: Flyer 1 */ \
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

${CSOUND_DEFINE} INSTANCE_NAME #"DAW playback"#
${CSOUND_INCLUDE} "af_global.orc"

#define LOW_CHANNEL_COUNT_INDEX 0
#define HIGH_CHANNEL_COUNT_INDEX 1

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

${CSOUND_IFDEF} IS_MIXDOWN
    // Camera matrixes generated in JavaScript.
    giMainCameraArrayLength init _($){SHARED.MainCameraArray.length}
    giMainCameraArrayMatrixes[] init _($){SHARED.MainCameraArray.matrixesString}
${CSOUND_ENDIF}

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

        while (iI != -1) do
            SFileName = sprintf("json/%s.%d.json", SPluginUuid, iI)
            if (filevalid(SFileName) == false) then
                iI = -1
            else
                iLineNumber = 0
                while (iLineNumber != -1) do
                    SLine, iLineNumber readfi SFileName

                    if (iLineNumber == -1) then
                        log_i_debug("%s - done", SFileName)
                    else
                        if (iWriteComma == true) then
                            fprints("DawPlayback.json", ",")
                        else
                            iWriteComma = true
                        endif

                        // Remove trailing newline.
                        if (strcmp(strsub(SLine, strlen(SLine) - 1, strlen(SLine)), "\n") == 0) then
                            SLine = strsub(SLine, 0, strlen(SLine) - 1)
                        endif

                        // Workaround Csound readfi opcode bug duplicating first letter of each line after first line.
                        if (iLineNumber > 1) then
                            SLine = strsub(SLine, 1, strlen(SLine))
                        endif

                        fprints("DawPlayback.json", SLine)
                        log_i_debug("%s(%d): %s", SFileName, iLineNumber, SLine)
                    endif
                od

                iI += 1
            endif
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
    ${CSOUND_IFDEF} IS_MIXDOWN
        // Ignore rotation for mixdown. The rotation is applied during playback instead.
        // NB: We rotate around the y axis by negative PI/2 so the rotation is correct during playback. TODO: figure out why we need this.
        am0 init 0
        am1 init 0
        am2 init -1
        am3 init 0
        am4 init 1
        am5 init 0
        am6 init 1
        am7 init 0
        am8 init 0
    ${CSOUND_ELSE}
        am0 = a(gk_AF_3D_ListenerRotationMatrix[0])
        am1 = a(gk_AF_3D_ListenerRotationMatrix[1])
        am2 = a(gk_AF_3D_ListenerRotationMatrix[2])
        am3 = a(gk_AF_3D_ListenerRotationMatrix[3])
        am4 = a(gk_AF_3D_ListenerRotationMatrix[4])
        am5 = a(gk_AF_3D_ListenerRotationMatrix[5])
        am6 = a(gk_AF_3D_ListenerRotationMatrix[6])
        am7 = a(gk_AF_3D_ListenerRotationMatrix[7])
        am8 = a(gk_AF_3D_ListenerRotationMatrix[8])
    ${CSOUND_ENDIF}
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
    aMainVolume = a(kMainVolume)
    outs(aL * aMainVolume, aR * aMainVolume)

    ${CSOUND_IFDEF} IS_MIXDOWN
        // Add reverb.
        aw += ga_masterSignals[4]

        fout("mixdown-wyzx.aif", 9, aw, ay, az, ax)
    ${CSOUND_ENDIF}
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


${CSOUND_IFDEF} IS_MIXDOWN
    instr SetMixdownListenerPosition
        iTableNumber init 1
        ii = 0
        while (ii < 16) do
            tablew(giMainCameraArrayMatrixes[ii], ii, iTableNumber)
            ii += 1
        od
        turnoff
    endin
${CSOUND_ENDIF}


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
i "SendEndedMessage" 5 -1

${CSOUND_IFDEF} IS_GENERATING_JSON
    i "GenerateJson" 0 1
${CSOUND_ELSE}
    ; Allow time to rewind the score. Csound will error out if the score times out before it is rewound.
    e 6
${CSOUND_ENDIF}

</CsScore>
</CsoundSynthesizer>
<Cabbage>
</Cabbage>
