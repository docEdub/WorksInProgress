include_guard()

set(Project_SynthUdoFiles
    "TriangleUdo1.h.orc"
)

set(CSOUND_CMAKE_SYNTH_UDO_DIR "${CMAKE_CURRENT_LIST_DIR}/SynthUdos")

foreach(file ${Project_SynthUdoFiles})
    configure_file("${CSOUND_CMAKE_SYNTH_UDO_DIR}/${file}" "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${file}")
endforeach()

# if(NOT ${Build_InlineIncludes} EQUAL ON)
#     foreach(file ${Project_SynthUdoFiles})
#         get_dependencies(file_dependencies "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${file}")
#         add_preprocess_file_command(
#             "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${file}"
#             "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${file}"
#             DEPENDS ${file_dependencies}
#         )
#         list(APPEND Project_SynthUdo_Dependencies "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${file}")
#     endforeach()
# endif()

# add_custom_target(Project.SynthUdo ALL DEPENDS ${Project_SynthUdo_Dependencies})
# add_dependencies(CsoundCMake.Core Project.SynthUdo)
