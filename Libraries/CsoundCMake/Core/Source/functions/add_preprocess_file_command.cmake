
include_guard()

include("${CsoundCMake.Core_DIR}/Source/global.cmake")

set(PREPROCESSOR_INCLUDE_DIR ${CSOUND_CMAKE_CONFIGURED_FILES_DIR})

function(add_preprocess_file_command)
    set(in_file "${ARGV0}")
    set(out_file "${ARGV1}")
    add_custom_command(OUTPUT "${out_file}" DEPENDS "${in_file}" WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
        COMMAND ${CMAKE_COMMAND}
            -DCMAKE_C_COMPILER=\"${CMAKE_C_COMPILER}\"
            -DCMAKE_C_COMPILER_ID=\"${CMAKE_C_COMPILER_ID}\"
            -DCsoundCMake.Core_DIR=\"${CsoundCMake.Core_DIR}\"
            -DPREPROCESSOR_INCLUDE_DIR=\"${PREPROCESSOR_INCLUDE_DIR}\"
            -DIN_FILE=\"${in_file}\"
            -DOUT_FILE=\"${out_file}\"
            -P "${CsoundCMake.Core_DIR}/Source/scripts/preprocess_file_script.cmake")
endfunction()
