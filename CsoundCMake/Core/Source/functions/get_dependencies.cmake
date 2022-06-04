
include_guard()

include("${CsoundCMake.Core_DIR}/Source/global.cmake")

function(get_dependencies)
    set(out_variable ${ARGV0})
    set(in_file "${ARGV1}")

    # Check arguments.
    set(arguments_valid TRUE)
    if(NOT in_file OR "${in_file}" STREQUAL "")
        set(arguments_valid FALSE)
        message(SEND_ERROR "No input file specified.")
    elseif(NOT IS_ABSOLUTE "${in_file}")
        set(arguments_valid FALSE)
        message(SEND_ERROR "Input file path not absolute. ${in_file}")
    elseif(NOT EXISTS "${in_file}")
        set(arguments_valid FALSE)
        message(SEND_ERROR "Input file not found. \"${in_file}\"")
    endif()

    # Check global variables.
    set(global_variables_valid TRUE)
    if(NOT PREPROCESSOR_INCLUDE_DIR OR "${PREPROCESSOR_INCLUDE_DIR}" STREQUAL "")
        set(global_variables_valid FALSE)
        message(SEND_ERROR "PREPROCESSOR_INCLUDE_DIR not set.")
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
    
    # Set `compiler` and `flags` local variables.
    if("AppleClang" STREQUAL "${CMAKE_C_COMPILER_ID}")
        set(compiler "${CMAKE_C_COMPILER}")
        set(include_flags -I${PREPROCESSOR_INCLUDE_DIR})
        # -MM:   Write dependencies to stdout.
        # -x c:  Force language to C.
        # See https://clang.llvm.org/docs/ClangCommandLineReference.html#preprocessor-flags.
        set(flags -MM -x c ${include_flags} ${in_file})
    elseif("MSVC" STREQUAL "${CMAKE_C_COMPILER_ID}")
        set(compiler "${CMAKE_C_COMPILER}")
        set(include_flags /I${PREPROCESSOR_INCLUDE_DIR})
        # /showIncludes:  Write dependencies to stdout (NB: Output includes compiler errors).
        # /TC:            Force language to C for all files given on command line.
        set(flags /nologo /showIncludes /TC ${include_flags} ${in_file})
    else()
        message(FATAL_ERROR "Compiler \"${CMAKE_C_COMPILER_ID}\" is not supported yet.")
    endif()

    # Set `working_directory` local variable to directory containing input file.
    get_filename_component(working_directory "${in_file}" DIRECTORY)

    # Run compiler command with compiler-specific flags to write dependencies to stdout.
    execute_process(COMMAND "${compiler}" ${flags} WORKING_DIRECTORY "${working_directory}" RESULT_VARIABLE result
        OUTPUT_VARIABLE stdout)

    # Parse output file.
    if("AppleClang" STREQUAL "${CMAKE_C_COMPILER_ID}")
        string(REPLACE "\\\n" ";" dependencies ${stdout})
        list(REMOVE_AT dependencies 0 1)
    elseif("MSVC" STREQUAL "${CMAKE_C_COMPILER_ID}")
        # The MSVC compiler generates errors while listing the included files and prefixes the included files with ...
        # "Note: including file: "
        string(REPLACE "\n" ";" dependencies ${stdout})
        foreach(dependency ${dependencies})
            string(FIND "${dependency}" "Note: including file: " position)
            if(${position} EQUAL 0)
                string(REPLACE "Note: including file: " "" dependency "${dependency}")
                string(STRIP "${dependency}" dependency)
                string(REPLACE "\\" "/" dependency "${dependency}")
                list(APPEND filtered_dependencies "${dependency}")
            endif()
        endforeach()
        set(dependencies ${filtered_dependencies})
    endif()
    foreach(dependency ${dependencies})
        string(STRIP "${dependency}" dependency)
        list(APPEND stripped_dependencies "${dependency}")
    endforeach()
    set(${out_variable} ${stripped_dependencies} PARENT_SCOPE)
endfunction()
