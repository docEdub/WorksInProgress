
include_guard()

include("${CsoundCMake_DIR}/global.cmake")

function(add_run_csound_command)
    set(in_file "${ARGV0}")
    set(out_file "${ARGV1}")
    add_custom_command(OUTPUT "${out_file}" DEPENDS "${in_file}" WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
        COMMAND ${CMAKE_COMMAND}
            -DCsoundCMake_DIR=\"${CsoundCMake_DIR}\"
            -DIN_FILE=\"${in_file}\"
            -DOUT_FILE=\"${out_file}\"
            -P "${CsoundCMake_DIR}/scripts/run_csound_script.cmake")
endfunction()
