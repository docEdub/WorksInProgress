<CsoundSynthesizer>
<CsOptions>

--midi-device=0
--nodisplays
--nosound
-+rtmidi=null

</CsOptions>
<CsInstruments>

instr 1
    ki init 0
    ki = wrap(ki + 1, 1, 1000)
    printsk("ki = %03d\n", ki)
endin

</CsInstruments>
<CsScore>

i1 0 z

</CsScore>
</CsoundSynthesizer>
