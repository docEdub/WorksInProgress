
include("${CsoundCMake.Cabbage_DIR}/Source/ui/Settings.cmake")

set(preprocessed_files
    "Position_ccIndexes.orc"
    "Position_defines.h"
    "Position_global.orc"
    "Position_instr_1_head.orc"
    "Position_iXYZ.orc"
    "Position_kXYZ.orc"
    )

set(configured_files
    ${preprocessed_files}
    "Position.ui"
    )

set(source_dir "${CsoundCMake.Cabbage_DIR}/Source/ui")

foreach(file ${configured_files})
    configure_file("${source_dir}/${file}" "${CSD_CONFIGURED_FILES_DIR}/${file}")
endforeach()

foreach(file ${preprocessed_files})
    if(NOT ${Build_InlineIncludes} EQUAL ON)
        add_preprocess_file_command(
            "${CSD_CONFIGURED_FILES_DIR}/${file}"
            "${CSD_PREPROCESSED_FILES_DIR}/${file}"
            DEPENDS CsoundCMake.Cabbage
            )

        # Add this file's preprocess target to the .csd file's preprocess target's dependencies.
        # See CsoundCMakeConfig.cmake.
        list(APPEND CSD_DEPENDS "${CSD_PREPROCESSED_FILES_DIR}/${file}")
    endif()
endforeach()
