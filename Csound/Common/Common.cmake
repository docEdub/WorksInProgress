
set(Project_Common_HeaderFiles
    "synth.h.csd"
    )

set(Project_Common_OrcFiles
    "watchOrcFile.orc"
    )

macro(add_csd_specific_configured_file file)
    configure_file("${CMAKE_CURRENT_LIST_DIR}/${file}" "${CSD_CONFIGURED_FILES_DIR}/${file}")
endmacro()

macro(add_csd_specific_preprocessed_file file)
    add_csd_specific_configured_file("${file}")

    if(NOT ${Build_InlineIncludes} EQUAL ON)
        get_dependencies(file_dependencies "${CSD_CONFIGURED_FILES_DIR}/${file}")
        add_preprocess_file_command(
            "${CSD_CONFIGURED_FILES_DIR}/${file}"
            "${CSD_PREPROCESSED_FILES_DIR}/${file}"
            DEPENDS ${file_dependencies}
        )
        list(APPEND CSD_DEPENDS "${CSD_PREPROCESSED_FILES_DIR}/${file}")
    endif()
endmacro()

foreach(file ${Project_Common_HeaderFiles})
    add_csd_specific_configured_file("${file}")
endforeach()

foreach(file ${Project_Common_OrcFiles})
    add_csd_specific_preprocessed_file("${file}")
endforeach()
