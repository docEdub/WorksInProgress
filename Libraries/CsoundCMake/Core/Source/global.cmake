
include_guard()

set(CSOUND_CMAKE_OUTPUT_DIR "${CMAKE_SOURCE_DIR}/_.output")
if(${Build_InlineIncludes})
    set(CSOUND_CMAKE_OUTPUT_DIR "${CSOUND_CMAKE_OUTPUT_DIR}/inlined")
else()
    set(CSOUND_CMAKE_OUTPUT_DIR "${CSOUND_CMAKE_OUTPUT_DIR}/included")
endif()
string(REPLACE "/" "\\\\" CSOUND_CMAKE_OUTPUT_NATIVE_DIR "${CSOUND_CMAKE_OUTPUT_DIR}")
set(CSOUND_CMAKE_CONFIGURED_FILES_DIR "${CSOUND_CMAKE_OUTPUT_DIR}/.configured")

set(CSOUND_COMMAND "C:/Program Files/Csound6_x64/bin/csound.exe")
string(REPLACE "/" "\\\\" CSOUND_COMMAND_NATIVE "${CSOUND_COMMAND}")
