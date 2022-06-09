include_guard()

set(Project_EffectUdoFiles
    "HighPassFilter.h.orc"
)

foreach(file ${Project_EffectUdoFiles})
    configure_file(
        "${CMAKE_CURRENT_LIST_DIR}/EffectUdos/${file}"
        "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/Udos/EffectUdos/${file}"
    )
endforeach()
