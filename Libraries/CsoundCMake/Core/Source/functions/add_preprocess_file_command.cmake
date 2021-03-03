
include_guard()

include("${CsoundCMake.Core_DIR}/Source/global.cmake")

if(${Build_InlineIncludes})
    set(PREPROCESSOR_INCLUDE_DIR_1 ${CSOUND_CMAKE_CONFIGURED_FILES_DIR})
    set(PREPROCESSOR_INCLUDE_DIR_2 ${CSOUND_CMAKE_OUTPUT_DIR})
else()
    set(PREPROCESSOR_INCLUDE_DIR_1 "${CSOUND_CMAKE_OUTPUT_DIR}")
    set(PREPROCESSOR_INCLUDE_DIR_2 ".")
endif()

function(add_preprocess_file_command)
    set(in_file "${ARGV0}")
    set(out_file "${ARGV1}")
    add_custom_command(OUTPUT "${out_file}" DEPENDS "${in_file}" WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
        COMMAND ${CMAKE_COMMAND}
            -DCMAKE_C_COMPILER=\"${CMAKE_C_COMPILER}\"
            -DCMAKE_C_COMPILER_ID=\"${CMAKE_C_COMPILER_ID}\"
            -DCsoundCMake.Core_DIR=\"${CsoundCMake.Core_DIR}\"
            -DPREPROCESSOR_INCLUDE_DIR_1=\"${PREPROCESSOR_INCLUDE_DIR_1}\"
            -DPREPROCESSOR_INCLUDE_DIR_2=\"${PREPROCESSOR_INCLUDE_DIR_2}\"
            -DIN_FILE=\"${in_file}\"
            -DOUT_FILE=\"${out_file}\"
            -P "${CsoundCMake.Core_DIR}/Source/scripts/preprocess_file_script.cmake")
endfunction()
