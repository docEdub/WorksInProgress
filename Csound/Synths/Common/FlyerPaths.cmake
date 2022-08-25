
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

read_shared_module_property(Flyer1Path.audioPointsString Flyer1Path.audioPointsString)
read_shared_module_property(Flyer1Path.speedMultiplier Flyer1Path.speedMultiplier)
read_shared_module_property(Flyer2Path.audioPointsString Flyer2Path.audioPointsString)
read_shared_module_property(Flyer2Path.speedMultiplier Flyer2Path.speedMultiplier)
read_shared_module_property(Flyer3Path.audioPointsString Flyer3Path.audioPointsString)
read_shared_module_property(Flyer3Path.speedMultiplier Flyer3Path.speedMultiplier)
