#include <definitions.h>

<CsoundSynthesizer>
<CsOptions>

--messagelevel=${CSOUND_MESSAGE_LEVEL}
--midi-device=0
--nodisplays
--nosound
-+rtmidi=null

</CsOptions>
<CsInstruments>

ksmps = 64
nchnls = 6
0dbfs = 1

#define Init_instrnum 1
#define ClearSignals_instrnum 2

#include "_.mode3_TrackDefines.h"

${CSOUND_DEFINE} INSTANCE_NAME #"TestSynth playback"#
${CSOUND_INCLUDE} "core_global.orc"
${CSOUND_INCLUDE} "time.orc"

#define LOW_CHANNEL_COUNT_INDEX 0
#define HIGH_CHANNEL_COUNT_INDEX 1

gi_instrumentCount = 1
gi_instrumentIndexOffset = 0
gaInstrumentSignals[][] init gi_instrumentCount, nchnls

gi_auxCount = 1
gi_auxIndexOffset = 0
giAuxChannelIndexRanges[][][] init gi_auxCount, gi_instrumentCount, 2 // 3rd column contains { [0]: low index, [1]: high index }
ga_auxVolumes[][][] init gi_auxCount, gi_instrumentCount, nchnls
ga_auxSignals[][] init gi_auxCount, nchnls

gi_trackCount = gi_instrumentCount + gi_auxCount
giMasterChannelIndexRanges[][] init gi_trackCount, 2 // 2nd column contains { [0]: low index, [1]: high index }
ga_masterVolumes[][] init gi_trackCount, nchnls
ga_masterSignals[] init nchnls


instr Init_instrnum
    gi_instrumentCount = p4
    gi_instrumentIndexOffset = p5
    gi_auxCount = p6
    gi_auxIndexOffset = p7
    gi_trackCount = gi_instrumentCount + gi_auxCount

    a_instrumentSignals[][] init gi_instrumentCount, nchnls
    gaInstrumentSignals = a_instrumentSignals

    // TODO: Make the DAW service set these using score lines.
    iAuxChannelIndexRanges[][][] init gi_auxCount, gi_instrumentCount, 2
    iI = 0
    while (iI < gi_auxCount) do
        iJ = 0
        while (iJ < gi_instrumentCount) do
            iAuxChannelIndexRanges[iI][iJ][LOW_CHANNEL_COUNT_INDEX] = 0
            iAuxChannelIndexRanges[iI][iJ][HIGH_CHANNEL_COUNT_INDEX] = nchnls - 1
            iJ += 1
        od
        iI += 1
    od
    giAuxChannelIndexRanges = iAuxChannelIndexRanges

    a_auxVolumes[][][] init gi_auxCount, gi_instrumentCount, nchnls
    ga_auxVolumes = a_auxVolumes

    a_auxSignals[][] init gi_auxCount, nchnls
    ga_auxSignals = a_auxSignals


    // TODO: Make the DAW service set these using score lines.
    iMasterChannelIndexRanges[][] init gi_trackCount, 2
    iI = 0
    while (iI < gi_trackCount) do
        iMasterChannelIndexRanges[iI][LOW_CHANNEL_COUNT_INDEX] = 0
        iMasterChannelIndexRanges[iI][HIGH_CHANNEL_COUNT_INDEX] = nchnls - 1
        iI += 1
    od
    giMasterChannelIndexRanges = iMasterChannelIndexRanges

    a_masterVolumes[][] init gi_trackCount, nchnls
    ga_masterVolumes = a_masterVolumes

    a_masterSignals[] init nchnls
    ga_masterSignals = a_masterSignals

    event_i("i", ClearSignals_instrnum, 0, -1)      // clear signals
    event_i("i", AuxMixInstrument, 0, -1) // mix instruments into auxes
    event_i("i", FinalMixInstrument, 0, -1)   // mix signals

    turnoff
endin


// Clear signals instrument. All included instruments should have instrument numbers higher than this instrument.
//
instr ClearSignals_instrnum
    gk_i += 1

    k_instrument = 0
    while (k_instrument < gi_instrumentCount) do
        k_channel = 0
        while (k_channel < nchnls) do
            gaInstrumentSignals[k_instrument][k_channel] = 0
            k_channel += 1
        od
        k_instrument += 1
    od

    k_bus = 0
    while (k_bus < gi_auxCount) do
        k_channel = 0
        while (k_channel < nchnls) do
            ga_auxSignals[k_bus][k_channel] = 0
            k_channel += 1
        od
        k_bus += 1
    od

    k_channel = 0
    while (k_channel < nchnls) do
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
            SFileName = sprintf("%s.%d.json", SPluginUuid, iI)

            iJ = 0
            while (iJ != -1) do
                // Csound will delete this instrument if the given file doesn't exist.
                SLine, iJ readfi SFileName

                if (iJ == -1) then
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
                    fprints("DawPlayback.json", SLine)
                    log_i_debug("%s(%d): %s", SFileName, iJ, SLine)
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
            if (strlen(gSPluginUuids[iI][0]) == 36) then // 36 == UUID length
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
    while (kChannel < nchnls) do
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
    // NB: `kTrack` is not reset before entering the next loop. This is intentional.
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

    // Output master.
    kChannel = 0
    while (kChannel < nchnls) do
        outch(kChannel + 1, ga_masterSignals[kChannel])
        kChannel += 1
    od
endin

</CsInstruments>
<CsScore>

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

#include "_.mode3_TrackSet.sco"
#include "_.mode3.sco"
#include "_.mode4.sco"

${CSOUND_IFDEF} IS_GENERATING_JSON
    s
    i "GenerateJson" 0 1
${CSOUND_ENDIF}

</CsScore>
</CsoundSynthesizer>
<Cabbage>
</Cabbage>
