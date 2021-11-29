#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: Position_instr_1_head.orc
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_IFNDEF} Position_instr_1_head_orc
${CSOUND_INCLUDE_GUARD_DEFINE} Position_instr_1_head_orc ${CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION}

if (time_k() < giPositionOpcodeComboBoxInitTime) then
    SPositionOpcode = chnget:S("positionOpcode")
    if (changed2(SPositionOpcode) == true && strlenk(SPositionOpcode) > 0) then
        // Initialize combobox index to match texteditor string.
        ki = 0
        while (ki < lenarray(gSPositionOpcodeComboBoxValues)) do
            if (strcmpk(SPositionOpcode, gSPositionOpcodeComboBoxValues[ki]) == 0) then
                chnsetks(sprintfk("value(%d)", ki + 1), "positionOpcodeComboBoxIndexUi")
            endif
            ki += 1
        od
    endif
else
    kPositionOpcodeComboBoxIndex = chnget:k("positionOpcodeComboBoxIndex")
    if (changed2(kPositionOpcodeComboBoxIndex) == true) then
        // Set texteditor string to match combobox index.
        log_k_trace("positionOpcodeComboBoxIndex = %d", kPositionOpcodeComboBoxIndex)
        chnsetks(sprintfk("text(\"%s\")", gSPositionOpcodeComboBoxValues[kPositionOpcodeComboBoxIndex - 1]),
            "positionOpcodeUi")
    endif
endif

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE_GUARD_ENDIF}
