

function(read_shared_module_property property output_variable)
    execute_process(
        COMMAND node ./BabylonJs/SharedModules/read-cli.js -- ${property}
        WORKING_DIRECTORY "${ROOT_DIR}"
        RESULT_VARIABLE result
        OUTPUT_VARIABLE stdout
        ERROR_VARIABLE error
    )

    # message("result = ${result}")
    # message("stdout = ${stdout}")
    # message("error = ${error}")

    if ("" STREQUAL "${error}")
        set(${output_variable} ${stdout} PARENT_SCOPE)
    else()
        set(${output_variable} "${error}" PARENT_SCOPE)
        message(FATAL_ERROR "${error}")
    endif()
endfunction()

read_shared_module_property(${RimMesh}.segments RimMesh.segments)
read_shared_module_property(${RimMesh}.rows RimMesh.rows)
read_shared_module_property(${RimMesh}.audioPositionsString RimMesh.audioPositionsString)
