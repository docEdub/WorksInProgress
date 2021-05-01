
set(Project_Common_OrcFiles
    "watchOrcFile.orc"
    )

foreach(orc_file ${Project_Common_OrcFiles})
    configure_file("${CMAKE_CURRENT_LIST_DIR}/${orc_file}" "${CSD_CONFIGURED_FILES_DIR}/${orc_file}")
endforeach()

if(NOT ${Build_InlineIncludes} EQUAL ON)
    foreach(orc_file ${Project_Common_OrcFiles})
        get_dependencies(orc_file_dependencies "${CSD_CONFIGURED_FILES_DIR}/${orc_file}")
        add_preprocess_file_command(
            "${CSD_CONFIGURED_FILES_DIR}/${orc_file}"
            "${CSD_PREPROCESSED_FILES_DIR}/${orc_file}"
            DEPENDS ${orc_file_dependencies}
        )
        list(APPEND CSD_DEPENDS "${CSD_PREPROCESSED_FILES_DIR}/${orc_file}")
    endforeach()
endif()
