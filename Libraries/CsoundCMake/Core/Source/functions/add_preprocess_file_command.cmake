
include_guard()

include("${CsoundCMake.Core_DIR}/Source/global.cmake")

function(add_preprocess_file_command)
    set(in_file "${ARGV0}")
    set(out_file "${ARGV1}")

    set(options CSOUND_ERROR_CHECK)
    set(one_value_keywords)
    set(multi_value_keywords DEPENDS)
    cmake_parse_arguments(ARG "${options}" "${one_value_keywords}" "${multi_value_keywords}" ${ARGN})

    if("${Build_CsoundErrorChecks}" STREQUAL "ON" AND ${ARG_CSOUND_ERROR_CHECK})
        # message("Doing Csound error checking on ${out_file}")
        get_filename_component(out_file_name "${out_file}" NAME)
        set(error_check_file "${CSOUND_CMAKE_ERROR_CHECK_DIR}/${out_file_name}")
        add_custom_command(
            OUTPUT "${out_file}"
            MAIN_DEPENDENCY "${in_file}"
            DEPENDS ${ARG_DEPENDS}
            WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
            COMMAND
                ${CMAKE_COMMAND}
                    -DPREPROCESSOR_INCLUDE_DIR=\"${PREPROCESSOR_INCLUDE_DIR}\"
                    -DCMAKE_C_COMPILER=\"${CMAKE_C_COMPILER}\"
                    -DCMAKE_C_COMPILER_ID=\"${CMAKE_C_COMPILER_ID}\"
                    -DCsoundCMake.Core_DIR=\"${CsoundCMake.Core_DIR}\"
                    -DBuild_InlineIncludes=${Build_InlineIncludes}
                    -DIN_FILE=\"${in_file}\"
                    -DOUT_FILE=\"${error_check_file}\"
                    -P "${CsoundCMake.Core_DIR}/Source/scripts/preprocess_file_script.cmake"
                # Run csound syntax check with stderr redirected to /dev/null. On error, run same command again without
                # stderr redirect so errors are shown.
                && (csound
                        --syntax-check-only
                        "${error_check_file}"
                        >/dev/null 2>&1
                    || csound
                        --messagelevel=0
                        --syntax-check-only
                        "${error_check_file}"
                        >/dev/null
                    )
                # If the error check file is different than the out file, copy the contents to the out file.
                # NB: We copy the contents only because copying the file itself breaks plugin .csd symlinks.
                && (${CMAKE_COMMAND} -E compare_files "${error_check_file}" "${out_file}"
                    || cat "${error_check_file}" >"${out_file}"
                    )
        )
    else()
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
    endif()
endfunction()
