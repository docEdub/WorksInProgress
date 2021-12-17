#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: core_global.orc
// 
// Csound globals used in Cabbage plugins and the DAW service.
//----------------------------------------------------------------------------------------------------------------------

${CSOUND_IFNDEF} CSD_FILE_PATH
    ${CSOUND_DEFINE} CSD_FILE_PATH #"undefined"#
${CSOUND_ENDIF}

${CSOUND_IFNDEF} INSTANCE_NAME
    ${CSOUND_DEFINE} INSTANCE_NAME #""#
${CSOUND_ENDIF}

gS_csdFileName = "undefined"
gS_csdFilePath = $CSD_FILE_PATH
gS_instanceName = $INSTANCE_NAME

giKR init kr
gk_i init -1

${CSOUND_INCLUDE} "log.orc"
${CSOUND_INCLUDE} "string.orc"

//----------------------------------------------------------------------------------------------------------------------
