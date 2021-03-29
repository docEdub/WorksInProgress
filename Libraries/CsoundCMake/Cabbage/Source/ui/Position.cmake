
include("${CsoundCMake.Cabbage_DIR}/Source/global.cmake")

set(range_maxDistance "range(0, 100, 100, 1, 0.001)")

add_xypad_300x300(positionXY_xypad "positionXY" "Cartesian" "${red}, 32")
add_xypad_50x300_y(positionCartesianZ_xypad "positionCartesianZ" 150 "${xypad_range_minus_150_to_150}" "${yellow}, 16")
add_xypad_300x300(positionRT_xypad "positionRT" "Polar" "${red}, 32")
add_xypad_50x300_y(positionPolarZ_xypad "positionPolarZ" 150 "${xypad_range_minus_150_to_150}" "${yellow}, 16")

configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/Position.ui" "${CSD_CONFIGURED_FILES_DIR}/Position.ui")
configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/Position.orc" "${CSD_CONFIGURED_FILES_DIR}/Position.orc")

if(NOT ${Build_InlineIncludes} EQUAL ON)
    add_preprocess_file_command("${CSD_CONFIGURED_FILES_DIR}/Position.orc" "${CSD_PREPROCESSED_FILES_DIR}/Position.orc"
        DEPENDS CsoundCMake.Cabbage
        )

    # Add this file's preprocess target to the .csd file's preprocess target's dependencies.
    # See CsoundCMakeConfig.cmake.
    list(APPEND CSD_DEPENDS "${CSD_PREPROCESSED_FILES_DIR}/Position.orc")
endif()
