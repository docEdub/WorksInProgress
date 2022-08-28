
set(InstrumentName "Saw2FlyerSynth")

set(${InstrumentName}_preprocessed_files
    "${InstrumentName}_ccIndexes.orc"
    "${InstrumentName}_global.orc"
    "${InstrumentName}_instr_1_head.orc"
    )

set(${InstrumentName}_configured_files
    ${${InstrumentName}_preprocessed_files}
    "${InstrumentName}.ui"
    )

set(CSD_SOURCE_DIR "${CMAKE_CURRENT_LIST_DIR}")
include("${CMAKE_CURRENT_LIST_DIR}/../Common/CommonSynth.cmake")

include("${CMAKE_CURRENT_LIST_DIR}/Common/FlyerPaths.cmake")
add_csd_specific_configured_file("Common/FlyerPaths.orc")

foreach(file ${${InstrumentName}_configured_files})
    configure_file("${CMAKE_CURRENT_LIST_DIR}/${file}" "${CSD_CONFIGURED_FILES_DIR}/${file}")
endforeach()

foreach(file ${${InstrumentName}_preprocessed_files})
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
