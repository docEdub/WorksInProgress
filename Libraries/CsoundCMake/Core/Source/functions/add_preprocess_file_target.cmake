
include_guard()

include("${CsoundCMake.Core_DIR}/Source/global.cmake")

function(add_preprocess_file_target)
    set(in_file "${ARGV0}")
    set(out_file "${ARGV1}")

    set(options)
    set(one_value_keywords TARGET_NAME)
    set(multi_value_keywords DEPENDS)
    cmake_parse_arguments(ARG "${options}" "${one_value_keywords}" "${multi_value_keywords}" ${ARGN})
    
    if (ARG_DEPENDS STREQUAL "")
        message(FATAL_ERROR "DEPENDS argument not found.")
    endif()

    if(DEFINED ARG_TARGET_NAME)
        set(TARGET_NAME "${ARG_TARGET_NAME}")
    else()
        get_filename_component(in_file_name "${in_file}" NAME)
        string(REPLACE "." "_" in_file_name "${in_file_name}")
        set(TARGET_NAME "preprocess_${in_file_name}")
    endif()
    add_custom_target("${TARGET_NAME}"
        ALL
        COMMAND ${CMAKE_COMMAND}
            -DPREPROCESSOR_INCLUDE_DIR_1=\"${PREPROCESSOR_INCLUDE_DIR_1}\"
            -DCMAKE_C_COMPILER=\"${CMAKE_C_COMPILER}\"
            -DCMAKE_C_COMPILER_ID=\"${CMAKE_C_COMPILER_ID}\"
            -DCsoundCMake.Core_DIR=\"${CsoundCMake.Core_DIR}\"
            -DBuild_InlineIncludes=${Build_InlineIncludes}
            -DIN_FILE=\"${in_file}\"
            -DOUT_FILE=\"${out_file}\"
            -P "${CsoundCMake.Core_DIR}/Source/scripts/preprocess_file_script.cmake"
        DEPENDS ${ARG_DEPENDS}
        WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}")
endfunction()
