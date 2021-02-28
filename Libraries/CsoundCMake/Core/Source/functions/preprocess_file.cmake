
include_guard()

message("CsoundCMake_DIR == ${CsoundCMake_DIR}")
include("${CsoundCMake_DIR}/global.cmake")

function(preprocess_file)
    set(in_file "${ARGV0}")
    set(out_file "${ARGV1}")

    # Check arguments.
    set(arguments_valid TRUE)
    if(NOT in_file OR "${in_file}" STREQUAL "")
        set(arguments_valid FALSE)
        message(SEND_ERROR "No input file specified.")
    elseif(NOT IS_ABSOLUTE "${in_file}")
        set(arguments_valid FALSE)
        message(SEND_ERROR "Input file path not absolute.")
    elseif(NOT EXISTS "${in_file}")
        set(arguments_valid FALSE)
        message(SEND_ERROR "Input file not found. \"${in_file}\"")
    endif()
    if(NOT out_file OR "${out_file}" STREQUAL "")
        set(arguments_valid FALSE)
        message(SEND_ERROR "No output file specified.")
    elseif(NOT IS_ABSOLUTE "${out_file}")
        set(arguments_valid FALSE)
        message(SEND_ERROR "Output file path not absolute.")
    endif()

    # Check global variables.
    set(global_variables_valid TRUE)
    if(NOT PREPROCESSOR_INCLUDE_DIR_1 OR "${PREPROCESSOR_INCLUDE_DIR_1}" STREQUAL "")
        set(global_variables_valid FALSE)
        message(SEND_ERROR "PREPROCESSOR_INCLUDE_DIR_1 not set.")
    endif()
    if(NOT PREPROCESSOR_INCLUDE_DIR_1 OR "${PREPROCESSOR_INCLUDE_DIR_2}" STREQUAL "")
        set(global_variables_valid FALSE)
        message(SEND_ERROR "PREPROCESSOR_INCLUDE_DIR_2 not set.")
    endif()
    if(NOT CMAKE_C_COMPILER_ID OR "${CMAKE_C_COMPILER_ID}" STREQUAL "")
        set(global_variables_valid FALSE)
        message(SEND_ERROR "CMAKE_C_COMPILER_ID not set.")
    endif()
    if(NOT CMAKE_C_COMPILER OR "${CMAKE_C_COMPILER}" STREQUAL "")
        set(global_variables_valid FALSE)
        message(SEND_ERROR "CMAKE_C_COMPILER not set.")
    endif()

    # Early out if the arguments or global variables are invalid.
    if(NOT arguments_valid OR NOT global_variables_valid)
        return()
    endif()

    message(STATUS "Preprocessing \"${in_file}\" to \"${out_file}\"")
    
    # Set `compiler` and `flags` local variables.
    if("AppleClang" STREQUAL "${CMAKE_C_COMPILER_ID}")
        set(compiler "${CMAKE_C_COMPILER}")
        set(include_flags -I${PREPROCESSOR_INCLUDE_DIR_1})
        if(NOT "${PREPROCESSOR_INCLUDE_DIR_2}" STREQUAL "")
            set(include_flags ${include_flags} -I${PREPROCESSOR_INCLUDE_DIR_2})
        endif()
        # -C:    Preserve comments during preprocessing.
        # -E:    Only run the preprocessor.
        # -P:    Do not add #line directives to output.
        # -x c:  Force language to C.
        # See https://clang.llvm.org/docs/ClangCommandLineReference.html#preprocessor-flags.
        set(flags -C -E -P -x c ${include_flags} ${in_file})
    elseif("MSVC" STREQUAL "${CMAKE_C_COMPILER_ID}")
        string(REPLACE "/" "\\\\" compiler "${CMAKE_C_COMPILER}")
        string(REPLACE "/" "\\\\" PREPROCESSOR_INCLUDE_NATIVE_DIR_1 "${PREPROCESSOR_INCLUDE_NATIVE_DIR_1}")
        string(REPLACE "/" "\\\\" PREPROCESSOR_INCLUDE_NATIVE_DIR_2 "${PREPROCESSOR_INCLUDE_NATIVE_DIR_2}")
        set(include_flags /I ${PREPROCESSOR_INCLUDE_NATIVE_DIR_1})
        if(NOT "${PREPROCESSOR_INCLUDE_DIR_2}" STREQUAL "")
            set(include_flags ${include_flags} /I ${PREPROCESSOR_INCLUDE_NATIVE_DIR_2})
        endif()
        # /C:  Preserves comments during preprocessing.
        # /EP: Copies preprocessor output to standard output. Does not add #line directives to output.
        # See https://docs.microsoft.com/en-us/cpp/build/reference/compiler-options-listed-by-category#preprocessor.
        set(flags /C /EP /nologo ${include_flags} ${in_file})
    else()
        message(FATAL_ERROR "Unknown compiler id \"${CMAKE_C_COMPILER_ID}\"")
    endif()

    # Set `working_directory` local variable to directory containing input file.
    get_filename_component(working_directory "${in_file}" DIRECTORY)

    # Run compiler command with compiler-specific flags to preprocess input file to stdout.
    execute_process(COMMAND "${compiler}" ${flags} WORKING_DIRECTORY "${working_directory}" RESULT_VARIABLE result
        OUTPUT_VARIABLE stdout)

    # Early out if input file is empty.
    string(LENGTH "${stdout}" stdout_length)
    if(stdout_length EQUAL 1)
        file(WRITE "${out_file}" "")
        return()
    endif()

    # Make preprocessed output start on same line as preprocessed input.
    #     Set `esc` local variable to ASCII value 27 (something unlikely to conflict with file contents) so semicolons
    #     in output can be distinguished from semicolons added to CMake list from output's lines.
    string(ASCII 27 esc)
    #     Turn output lines into list of strings by swapping out line feeds with escape character and semicolon pairs.
    string(REPLACE "\n" "${esc};" stdout "${stdout}")
    #     Remove first line.
    list(REMOVE_AT stdout 0)
    if("MSVC" STREQUAL "${CMAKE_C_COMPILER_ID}")
        #     Count lines in definitions.h.
        file(READ "${CSOUND_CMAKE_OUTPUT_DIR}/definitions.h" definitions_h_text)
        string(REGEX MATCHALL "\n" definitions_h_newlines "${definitions_h_text}")
        list(LENGTH definitions_h_newlines definitions_h_line_count)
        if("AppleClang" STREQUAL "${CMAKE_C_COMPILER_ID}")
            message("line count = ${definitions_h_line_count}")
            MATH(EXPR definitions_h_line_count "${definitions_h_line_count} - 5")
            message("line count = ${definitions_h_line_count}")
        endif()
        #     Remove lines added for definitons.h
        string(REPLACE "\n" "${esc};" stdout "${stdout}")
        foreach(i RANGE ${definitions_h_line_count})
            # N.B. If a CMake error occurs here then make sure the input file starts with #include <definitions.h>.
            list(REMOVE_AT stdout 0)
        endforeach()
    endif()
    #     Swap escape character and semicolon pairs back out with line feeds.
    string(REPLACE "${esc};" "\n" stdout "${stdout}")

    # Write output file.
    file(WRITE "${out_file}" "${stdout}")
endfunction()
