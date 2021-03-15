
if(NOT PREPROCESSOR_INCLUDE_DIR)
    message(SEND_ERROR "PREPROCESSOR_INCLUDE_DIR not set.")
    set(bad_input true)
endif()
if(NOT CMAKE_C_COMPILER)
    message(SEND_ERROR "CMAKE_C_COMPILER not set")
    set(bad_input true)
endif()
if(NOT CMAKE_C_COMPILER_ID)
    message(SEND_ERROR "CMAKE_C_COMPILER_ID not set")
    set(bad_input true)
endif()
if(bad_input)
    message(FATAL_ERROR "One or more required input variables are not set")
endif()

cmake_policy(PUSH)
cmake_policy(SET CMP0007 NEW)

include("${CsoundCMake.Core_DIR}/Source/functions/preprocess_file.cmake")
include("${CsoundCMake.Core_DIR}/Source/global.cmake")
# include("${CsoundCMake.Core_DIR}/CsoundCMake.CoreCommon.cmake")

if(NOT ${Build_InlineIncludes} EQUAL ON)
    # foreach(orc_file ${ORC_FILES})
    #     preprocess_file(
    #         "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${orc_file}"
    #         "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${orc_file}")
    # endforeach()
    preprocess_file("${INPUT_FILE}" "${OUTPUT_FILE}")
endif()

cmake_policy(POP)
