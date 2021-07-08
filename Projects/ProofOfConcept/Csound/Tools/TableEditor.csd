<Cabbage>
form caption("Table Editor") size(512, 256), pluginid("0000")
texteditor bounds(0, 0, 512, 16), channel("tableScoreLine")
gentable bounds(0, 16, 512, 240), identchannel("tableView"), amprange(0, 1, 1), tablenumber(1), tablebackgroundcolour(128, 128, 128), tablecolour(64, 64, 64), tablegridcolour(0, 0, 0, 0), active(1)
</Cabbage>
<CsoundSynthesizer>
<CsOptions>
-d -n -m0d
</CsOptions>
<CsInstruments>
ksmps = 32
nchnls = 2
0dbfs = 1
instr 1
    STableScoreLine = chngetks("tableScoreLine")
    if(changed(STableScoreLine) == 1) then
        printsk(STableScoreLine)
        printsk("\n")
        scoreline(STableScoreLine, 1)
        chnset("tablenumber(1)", "tableView")
    endif
endin
</CsInstruments>
<CsScore>
; Distance attenuation curve - 2021-07-08--00:51
f1 0 101 8    1    5  .99    20  0.55    25  0.23    40   0.01    10  0
i1 0 z
</CsScore>
</CsoundSynthesizer>
