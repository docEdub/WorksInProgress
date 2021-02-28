
include_guard()

message("CsoundCMake_DIR == ${CsoundCMake_DIR}")
include("${CsoundCMake_DIR}/global.cmake")

function(run_csound)
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

    # Early out if the arguments or global variables are invalid.
    if(NOT arguments_valid)
        return()
    endif()
    
    # Set `working_directory` local variable to directory containing input file.
    get_filename_component(working_directory "${in_file}" DIRECTORY)

    # if(WIN32)
    #     string(REPLACE "/" "\\\\" OUT_FILE "${OUT_FILE}")
    # endif()

    # Run Csound command.
    execute_process(COMMAND "${CSOUND_COMMAND_NATIVE}" --output=${OUT_FILE} "${IN_FILE}" WORKING_DIRECTORY
        "${working_directory}")
endfunction()
