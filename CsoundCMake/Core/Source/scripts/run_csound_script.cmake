
if(NOT IN_FILE)
    message(SEND_ERROR "IN_FILE not set.")
    set(bad_input true)
endif()
if(NOT OUT_FILE)
    message(SEND_ERROR "OUT_FILE not set.")
    set(bad_input true)
endif()
if(bad_input)
    message(FATAL_ERROR "One or more required input variables are not set")
endif()

cmake_policy(PUSH)
cmake_policy(SET CMP0007 NEW)

include("${CsoundCMake.Core_DIR}/functions/run_csound.cmake")
run_csound("${IN_FILE}" "${OUT_FILE}")

cmake_policy(POP)
