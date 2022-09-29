<CsoundSynthesizer>
<CsOptions>

--messagelevel=0
; --messagelevel=134
--midi-device=0
--nodisplays
-+rtmidi=null

</CsOptions>
<CsInstruments>

sr = 48000
kr = 200
0dbfs = 1

giChannelCount = filenchnls("$INPUT_FILE")
giFilePeak = filepeak("$INPUT_FILE", 0)
giNormalizationFactor = 0.97 / giFilePeak
gaIn[] init giChannelCount

instr 1
    gaIn = diskin2("$INPUT_FILE")
endin

instr 2
    iChannelA = p4
    iChannelB = p4 + 1
    SOutputFileName = sprintf("normalized-%02d+%02d.aif", iChannelA + 1, iChannelB + 1)
    fout(SOutputFileName, 9, gaIn[iChannelA] * giNormalizationFactor, gaIn[iChannelB] * giNormalizationFactor)
endin

instr 3
    ii = 0
    while (ii < giChannelCount) do
        event_i("i", 2 + ii / 100, 0, -1, ii, ii + 1)
        ii += 2
    od

    prints("giChannelCount = %d\n", giChannelCount)
    prints("giFilePeak = %f\n", giFilePeak)
    prints("giNormalizationFactor = %f\n", giNormalizationFactor)

    kInputSeconds init filelen("$INPUT_FILE")
    kOutputSeconds = times:k()
    ; printsk("kInputSeconds = %d, kOutputSeconds = %d\n", kInputSeconds, kOutputSeconds)
    if (kInputSeconds <= kOutputSeconds) then
        printsk("turning instr 1 off ...\n")
        event("i", 4, 1, -1)
        turnoff
    endif
endin

instr 4
    prints("Exiting Csound ...\n")
    exitnow(0)
endin

</CsInstruments>
<CsScore>

i1 0 z
i3 0 z

</CsScore>
</CsoundSynthesizer>
<Cabbage>
</Cabbage>
