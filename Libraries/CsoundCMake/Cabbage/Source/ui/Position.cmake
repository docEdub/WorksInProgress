
include("${CsoundCMake.Cabbage_DIR}/Source/global.cmake")

set(range_maxDistance "range(0, 100, 100, 1, 0.001)")

add_xypad_300x300(positionXY_xypad "positionXY_xypad_" "Cartesian" "${red}, 32")
add_xypad_50x300_y(positionCartesianZ_xypad "positionCartesianZ_xypad_" 150 "${xypad_range_minus_150_to_150}" "${yellow}, 16")
add_xypad_300x300(positionRT_xypad "positionRT_xypad_" "Polar" "${red}, 32")
add_xypad_50x300_y(positionPolarZ_xypad "positionPolarZ_xypad_" 150 "${xypad_range_minus_150_to_150}" "${yellow}, 16")

set(file "ui/Position.ui")
configure_file(
    "${CsoundCMake.Cabbage_DIR}/Source/${file}"
    "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${CSOUND_CMAKE_OUTPUT_SUBDIRECTORY}/${file}")

configure_file(
    "${CsoundCMake.Cabbage_DIR}/Source/ui/Position.orc"
    "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${CSOUND_CMAKE_OUTPUT_SUBDIRECTORY}/Position.orc")

if(NOT ${Build_InlineIncludes} EQUAL ON)
    add_preprocess_file_target(
        "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${CSOUND_CMAKE_OUTPUT_SUBDIRECTORY}/Position.orc"
        "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${CSOUND_CMAKE_OUTPUT_SUBDIRECTORY}/Position.orc"
        DEPENDS CsoundCMake.Cabbage
        TARGET_NAME "${CSOUND_CMAKE_OUTPUT_SUBDIRECTORY}_preprocess_Position_orc")

    # Add this file's preprocess target to the .csd file's preprocess target's dependencies.
    # See CsoundCMakeConfig.cmake.
    list(APPEND CSD_DEPENDS ${CSOUND_CMAKE_OUTPUT_SUBDIRECTORY}_preprocess_Position_orc)
endif()
