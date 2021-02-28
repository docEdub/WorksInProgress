
include_guard()

get_filename_component(CSOUND_CMAKE_OUTPUT_DIR "../../../../wip.output" ABSOLUTE BASE_DIR "${CMAKE_SOURCE_DIR}")
string(REPLACE "/" "\\\\" CSOUND_CMAKE_OUTPUT_NATIVE_DIR "${CSOUND_CMAKE_OUTPUT_DIR}")
set(CSOUND_CMAKE_CONFIGURED_FILES_DIR "${CSOUND_CMAKE_OUTPUT_DIR}/.configured")

set(CSOUND_COMMAND "C:/Program Files/Csound6_x64/bin/csound.exe")
string(REPLACE "/" "\\\\" CSOUND_COMMAND_NATIVE "${CSOUND_COMMAND}")