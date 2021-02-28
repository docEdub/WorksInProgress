#include "definitions.h"

${CSOUND_INCLUDE} "log.orc"

gSTabChannels[] = fillarray(${csound_tab_channels})
giTabCount = lenarray(gSTabChannels)
gkTabIndex init 0

opcode tabPressed, k, k
    kTabIndex xin
    kPressed = chnget:k(gSTabChannels[kTabIndex])
    xout kPressed
endop

opcode hideAllTabs, 0, 0
    kI = 0
    while (kI < giTabCount) do
        chnsetks("visible(0)", sprintfk("%s_content_ui", gSTabChannels[kI]))
        kI += 1
    od
endop

opcode showTab, 0, k
    kTabIndex xin
    chnsetks("visible(1)", sprintfk("%s_content_ui", gSTabChannels[kTabIndex]))
endop

instr HandleTabButtons
    log_i_info("%s ...", nstrstr(p1))
    log_i_debug("Tab count = %d", giTabCount)

    kI = 0
    while (kI < giTabCount) do
        if (tabPressed(kI) == true) then
            gkTabIndex = kI
            kI = giTabCount // break
        else
            kI += 1
        endif
    od
    if (changed(gkTabIndex) == true) then
        log_k_debug("%s pressed", gSTabChannels[gkTabIndex])
        hideAllTabs()
        showTab(gkTabIndex)
    endif

    log_i_info("%s - done", nstrstr(p1))
endin

alwayson "HandleTabButtons"
