#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Saw2FlyerSynth_instr_1_head.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} Saw2FlyerSynth_instr_1_head_orc
${CSOUND_INCLUDE_GUARD_DEFINE} Saw2FlyerSynth_instr_1_head_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

if (time_k() < giFlyerDirectionComboBoxInitTime) then
    SFlyerDirection = chnget:S("flyerDirection")
    if (changed2(SFlyerDirection) == true && strlenk(SFlyerDirection) > 0) then
        // Initialize combobox index to match texteditor string.
        ki = 0
        while (ki < lenarray(gSFlyerDirectionComboBoxValues)) do
            if (strcmpk(SFlyerDirection, gSFlyerDirectionComboBoxValues[ki]) == 0) then
                chnsetks(sprintfk("value(%d)", ki + 1), "flyerDirectionComboBoxIndexUi")
            endif
            ki += 1
        od
    endif
else
    kFlyerDirectionComboBoxIndex = chnget:k("flyerDirectionComboBoxIndex")
    if (changed2(kFlyerDirectionComboBoxIndex) == true) then
        // Set texteditor string to match combobox index.
        chnsetks(sprintfk("text(\"%s\")", gSFlyerDirectionComboBoxValues[kFlyerDirectionComboBoxIndex - 1]),
            "flyerDirectionUi")
    endif
endif

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_ENDIF}
