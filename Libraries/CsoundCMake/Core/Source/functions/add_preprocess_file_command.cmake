
include_guard()

include("${CsoundCMake.Core_DIR}/Source/global.cmake")

function(add_preprocess_file_command)
    set(in_file "${ARGV0}")
    set(out_file "${ARGV1}")

    set(options)
    set(one_value_keywords)
    set(multi_value_keywords DEPENDS)
    cmake_parse_arguments(ARG "${options}" "${one_value_keywords}" "${multi_value_keywords}" ${ARGN})

    add_custom_command(
        OUTPUT "${out_file}"
        MAIN_DEPENDENCY "${in_file}"
        DEPENDS ${ARG_DEPENDS}
        WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
        COMMAND ${CMAKE_COMMAND}
            -DPREPROCESSOR_INCLUDE_DIR=\"${PREPROCESSOR_INCLUDE_DIR}\"
            -DCMAKE_C_COMPILER=\"${CMAKE_C_COMPILER}\"
            -DCMAKE_C_COMPILER_ID=\"${CMAKE_C_COMPILER_ID}\"
            -DCsoundCMake.Core_DIR=\"${CsoundCMake.Core_DIR}\"
            -DBuild_InlineIncludes=${Build_InlineIncludes}
            -DIN_FILE=\"${in_file}\"
            -DOUT_FILE=\"${out_file}\"
            -P "${CsoundCMake.Core_DIR}/Source/scripts/preprocess_file_script.cmake"
    )
endfunction()
