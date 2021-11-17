
include_guard()

set(CsoundCMake_Cabbage_HeaderFiles
    "cabbage_core_global.h"
    "cabbage_effect_global.h"
    "cabbage_synth_global.h"
)

set(CsoundCMake_Cabbage_OrcFiles
    "opcodes/adsr_linsegr.udo.orc"
    "ui/PositionOpcode_global.orc"
    "ui/PositionOpcode_instr_1_head.orc"
    "ui/TrackInfo_global.orc"
    "ui/TrackInfo_instr_1_head.orc"
    "cabbage_core_global.orc"
    "cabbage_core_instr_1_head.orc"
    "cabbage_effect_global.orc"
    "cabbage_synth_global.orc"
)

set(CABBAGE_PATH "/Applications/Cabbage-2.5.12.app" CACHE STRING " ")
# set(CABBAGE_PATH "/Applications/Cabbage-2.8.0.app" CACHE STRING " ")

LIST(APPEND CMAKE_PREFIX_PATH "${ROOT_DIR}/Libraries/CsoundCMake/Core")
find_package(CsoundCMake.Core REQUIRED)

set(Cabbage_LogCabbageOutput OFF CACHE BOOL)
set(Cabbage_UiGrid OFF CACHE BOOL)
set(Cabbage_UiOutlineGroups OFF CACHE BOOL)

function(add_vst3)
    set(csd "${ARGV0}")
    set(vst3_plugin_type "${ARGV1}")

    if(APPLE)
        get_filename_component(csd_file_name "${csd}" NAME)
        set(csd_output_file_path "${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}/${csd_file_name}")
        
        # Set VST3 plugin variables.
        get_output_vst3_file_path(plugin_path "${csd}")
        string(REPLACE "${CMAKE_BINARY_DIR}/" "" relative_plugin_path "${plugin_path}")

        # Export VST3 plugin to "${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}".
        add_custom_command(
            COMMENT "Generating ${relative_plugin_path}"
            OUTPUT "${plugin_path}/Contents/Info.plist"
            MAIN_DEPENDENCY "${csd_output_file_path}"
            COMMAND
                ${CMAKE_COMMAND} -E rm -rf "${plugin_path}" &&
                "${CABBAGE_PATH}/Contents/MacOS/Cabbage"
                    --export-${vst3_plugin_type}
                    "${csd_output_file_path}"
                    --destination "${plugin_path}"
                    > /dev/null 2>&1
            )

        # Link the output .csd to the plugin .csd.
        set(plugin_csd_file_path "${plugin_path}/Contents/${csd_file_name}")
        string(REPLACE "${CMAKE_BINARY_DIR}/" "" relative_csd_output_file_path "${csd_output_file_path}")
        string(REPLACE "${CMAKE_BINARY_DIR}/" "" relative_plugin_csd_file_path "${plugin_csd_file_path}")
        add_custom_command(
            COMMENT "Linking ${relative_csd_output_file_path} -> ${relative_plugin_csd_file_path}"
            OUTPUT "${plugin_csd_file_path}.stamp"
            MAIN_DEPENDENCY "${csd_output_file_path}"
            COMMAND
                ${CMAKE_COMMAND} -E touch "${plugin_csd_file_path}.stamp" &&
                ${CMAKE_COMMAND} -E rm -f "${plugin_csd_file_path}" &&
                ${CMAKE_COMMAND} -E create_hardlink "${csd_output_file_path}" "${plugin_csd_file_path}"
            DEPENDS
                "${plugin_path}/Contents/Info.plist"
            )
    endif()
endfunction()

function(add_vst3_effect)
    add_vst3("${ARGV0}" "VST3")
endfunction()

function(add_vst3_synth)
    add_vst3("${ARGV0}" "VST3i")
endfunction()

function(get_output_csd_file_path csd_file_path source_file_path)
    get_filename_component(source_file_name "${source_file_path}" NAME)
    set(${csd_file_path} "${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}/${source_file_name}" PARENT_SCOPE)
endfunction()

function(get_playback_output_csd_file_path csd_file_path source_file_path)
    get_filename_component(source_file_name "${source_file_path}" NAME)
    set(${csd_file_path} "${CSOUND_CMAKE_PLAYBACK_OUTPUT_DIR}/${source_file_name}" PARENT_SCOPE)
endfunction()

function(get_output_vst3_file_path vst3_file_path source_file_path)
    get_filename_component(source_file_name_we "${source_file_path}" NAME_WE)
    set(${vst3_file_path} "${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}/${source_file_name_we}.vst3" PARENT_SCOPE)
endfunction()

function(add_csd_targets)
    set(options OPTIONS)
    set(one_value_keywords ONE_VALUE_KEYWORDS)
    set(multi_value_keywords
        EFFECT_PLUGIN_SOURCES
        SYNTH_PLUGIN_SOURCES
        STANDALONE_SOURCES
        PLAYBACK_SOURCES
    )
    cmake_parse_arguments(ARG "${options}" "${one_value_keywords}" "${multi_value_keywords}" ${ARGN})

    foreach(csd IN LISTS ARG_EFFECT_PLUGIN_SOURCES ARG_SYNTH_PLUGIN_SOURCES ARG_STANDALONE_SOURCES)
        add_csd_implementation("${csd}" DEPENDS CsoundCMake.Cabbage)
        get_output_csd_file_path(output_csd "${csd}")
        list(APPEND csd_target_dependencies "${output_csd}")
        string(REPLACE ".csd" "Benchmark.csd" benchmark_csd "${CMAKE_CURRENT_LIST_DIR}/${csd}")
        if(EXISTS "${benchmark_csd}")
            string(REPLACE ".csd" "Benchmark.csd" benchmark_output_csd "${output_csd}")
            list(APPEND csd_target_dependencies "${benchmark_output_csd}")
            get_filename_component(benchmark_target "${benchmark_csd}" NAME_WE)
            add_custom_target(${benchmark_target}
                COMMAND csound "${benchmark_output_csd}" --messagelevel=128
                DEPENDS "${benchmark_output_csd}"
                )
        endif()
    endforeach()

    if("${BUILD_PLAYBACK_CSD}" STREQUAL "ON")
        foreach(csd IN LISTS ARG_PLAYBACK_SOURCES)
            add_playback_csd("${csd}" DEPENDS ${csd_target_dependencies})
            get_playback_output_csd_file_path(output_csd "${csd}")
            list(APPEND playback_csd_target_dependencies "${output_csd}")
        endforeach()
        set(csd_target_dependencies ${playback_csd_target_dependencies})
    endif()

    add_custom_target("csd" ALL DEPENDS ${csd_target_dependencies} CsoundCMake.Cabbage)
    add_custom_command(TARGET "csd" POST_BUILD COMMAND echo > ${CMAKE_BINARY_DIR}/build-passed)
    add_custom_command(TARGET "csd" POST_BUILD COMMAND echo > ${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}/uuid.txt)

    # Add vst3 target.
    if(NOT "${BUILD_PLAYBACK_CSD}" STREQUAL "ON")
        foreach(csd IN LISTS ARG_EFFECT_PLUGIN_SOURCES)
            get_filename_component(csd_file_name "${csd}" NAME)
            add_vst3_effect("${csd}")
            get_output_vst3_file_path(output_vst3 "${csd}")
            list(APPEND vst3_target_dependencies
                "${output_vst3}/Contents/Info.plist"
                "${output_vst3}/Contents/${csd_file_name}.stamp"
                )
        endforeach()

        foreach(csd IN LISTS ARG_SYNTH_PLUGIN_SOURCES)
            get_filename_component(csd_file_name "${csd}" NAME)
            add_vst3_synth("${csd}")
            get_output_vst3_file_path(output_vst3 "${csd}")
            list(APPEND vst3_target_dependencies
                "${output_vst3}/Contents/Info.plist"
                "${output_vst3}/Contents/${csd_file_name}.stamp"
                )
        endforeach()

        add_custom_target("vst3" DEPENDS "csd" ${vst3_target_dependencies})
    endif()
    
endfunction()

macro(define_cabbage_control_size PREFIX)
    if("small" STREQUAL "${PREFIX}")
        set(divisor "20")
    elseif("medium" STREQUAL "${PREFIX}")
        set(divisor "16")
    elseif("large" STREQUAL "${PREFIX}")
        set(divisor "12")
    else()
        message(FATAL_ERROR "Unknown prefix ${PREFIX}")
    endif()

    set(${PREFIX}_control_width MATH "${form_width} / ${divisor}")
    set(${PREFIX}_control_height "${${PREFIX}_control_width}")

    set(${PREFIX}_rslider_width "${${PREFIX}_control_width}")
    set(${PREFIX}_rslider_height "${${PREFIX}_control_width}")

    set(${PREFIX}_hslider_width MATH "(3 * ${${PREFIX}_control_width}) + (2 * ${padding})")
    set(${PREFIX}_hslider_height "${${PREFIX}_control_height}")

    set(${PREFIX}_vslider_width MATH "(${${PREFIX}_control_width} / 2) + ${padding}")
    set(${PREFIX}_vslider_height MATH "(${${PREFIX}_control_height} * 2)  + ${padding}")
endmacro()

#=======================================================================================================================
# Cabbage constants
#=======================================================================================================================

# Bounds related
set(padding "4")

# Colors
set(black "0, 0, 0")
set(blue "0, 0, 255")
set(clear "0, 0, 0, 0")
set(green "0, 255, 0")
set(dark_blue "0, 0, 128")
set(dark_green "0, 128, 0")
set(dark_grey "32, 32, 32")
set(dark_red "128, 0, 0")
set(grey "128, 128, 128")
set(light_blue "64, 64, 255")
set(light_grey "192, 192, 192")
set(light_red "255, 64, 64")
set(purple "255, 64, 255")
set(red "255, 0, 0")
set(white "255, 255, 255")
set(yellow "255, 255, 0")

# Color themes.
set(dark_theme "colour(${grey}) fontcolour(${black})")


if(Cabbage_UiOutlineGroups)
    set(group_alpha 32)
else()
    set(group_alpha 255)
endif()

#=======================================================================================================================
# Cabbage widgets and attributes
#=======================================================================================================================

# Private common widget base types
set(_slider "")

# Private slider widget base types
set(_linear_slider "${_slider}")
set(_radial_slider "${_slider}")

# Public widgets
set(button "button")
set(checkbox "checkbox colour(${red})")
set(combobox "combobox colour(${dark_grey})")
set(combobox_dark "combobox ${dark_theme}")
set(csoundoutput "csoundoutput style(\"monospaced\")")
set(form "form")
set(group "image colour(${dark_grey}, ${group_alpha})")
set(hslider "hslider ${_linear_slider} popuptext(0)")
set(keyboard "keyboard")
set(label "label corners(0) fontstyle(\"plain\")")
set(nslider "nslider")
set(nslider_dark "${nslider} ${dark_theme}")
set(rect "image")
set(rslider "rslider ${_radial_slider} trackerinsideradius(0.999) trackercolour(${dark_grey}) markerstart(0) markerthickness(100)")
set(rslider_small "rslider ${_radial_slider} trackerinsideradius(0.499) trackeroutsideradius(0.500) trackercolour(${dark_grey}) markerstart(0) markerthickness(100)")
set(texteditor "texteditor")
set(texteditor_dark "${texteditor} ${dark_theme}")
set(uuid_label "${texteditor} colour(${black}) fontcolour(${grey}) active(0)")
set(vslider "vslider ${_linear_slider} popuptext(0)")
set(xypad "xypad")

# Public attributes
set(hidden "bounds(0, 0, 0, 0)")

set(range_midi_1_centered "range(-64, 63, 0, 1, 1)")
set(range_midi_1_positive "range(0, 127, 0, 1, 1)")
set(range_midi_2_centered "range(-8192, 8191, 0, 1, 1)")
set(range_midi_2_positive "range(0, 16383, 0, 1, 1)")

set(range_0_to_1 "range(0, 1, 0, 1, .001)")
set(range_0_to_10 "range(0, 10, 0, 1, .001)")
set(range_0_to_100 "range(0, 100, 0, 1, .01)")
set(range_0_to_1000 "range(0, 1000, 0, 1, .1)")
set(range_0_to_10000 "range(0, 10000, 0, 1, 1)")
set(range_0_to_sqrt2 "range(0, 1.414213562373095, 0, 1, .001)")
set(range_minus_1_to_1 "range(-1, 1, 0, 1, .001)")
set(range_minus_180_to_180 "range(-180, 180, 0, 1, .001)")

set(xypad_range_0_to_1 "rangex(0, 1, 0.5) rangey(0, 1, 0.5)")
set(xypad_range_0_to_10 "rangex(0, 10, 5) rangey(0, 10, 5)")
set(xypad_range_minus_1_to_1 "rangex(-1, 1, 0) rangey(-1, 1, 0)")
set(xypad_range_0_to_200 "rangex(0, 200, 100) rangey(0, 200, 100)")
set(xypad_range_0_to_300 "rangex(0, 300, 150) rangey(0, 300, 150)")
set(xypad_range_minus_150_to_150 "rangex(-150, 150, 0) rangey(-150, 150, 0)")

set(dark_blue_radiogroup_colors "colour:0(${dark_grey}) colour:1(${dark_blue})")

# Grid widget
set(no_grid "")
if(NOT Cabbage_UiGrid)
    set(grid "")
else()
    macro(add_gridline)
        set(variable ${ARGV0})
        set(x ${ARGV1})
        set(y ${ARGV2})
        set(width ${ARGV3})
        set(height ${ARGV4})
        set(color "${ARGV5}")
        set(${variable} "${${variable}}
            image bounds(${x}, ${y}, ${width}, ${height}) colour(${color})")
    endmacro()

    macro(add_gridline_x)
        set(variable ${ARGV0})
        set(x ${ARGV1})
        set(y 0)
        set(width 1)
        set(height 500)
        set(color "${ARGV2}")
        add_gridline(${variable} ${x} ${y} ${width} ${height} ${color})
    endmacro()

    macro(add_gridline_y)
        set(variable ${ARGV0})
        set(x 0)
        set(y ${ARGV1})
        set(width 1000)
        set(height 1)
        set(color "${ARGV2}")
        add_gridline(${variable} ${x} ${y} ${width} ${height} ${color})
    endmacro()

    set(gridline_100_color "96, 96, 96")
    set(gridline_50_color "96, 0, 0")
    set(gridline_10_color "48, 48, 48")

    foreach(x RANGE 0 1000 10)
        add_gridline_x(grid ${x} "${gridline_10_color}")
    endforeach()

    foreach(x RANGE 0 1000 50)
        add_gridline_x(grid ${x} "${gridline_50_color}")
    endforeach()

    foreach(x RANGE 0 1000 100)
        add_gridline_x(grid ${x} "${gridline_100_color}")
    endforeach()

    foreach(y RANGE 0 500 10)
        add_gridline_y(grid ${y} "${gridline_10_color}")
    endforeach()

    foreach(y RANGE 0 500 50)
        add_gridline_y(grid ${y} "${gridline_50_color}")
    endforeach()

    foreach(y RANGE 0 500 100)
        add_gridline_y(grid ${y} "${gridline_100_color}")
    endforeach()
endif()

# Gridded group widget helpers
set(10_square "10, 10")
set(20_square "20, 20")
set(30_square "30, 30")
set(40_square "40, 40")
set(50_square "50, 50")
set(80_square "80, 80")
set(90_square "90, 90")
set(100_square "100, 100")
set(200_square "200, 200")
set(300_square "300, 300")

# Gridded widgets
set(_checkbox_background "${checkbox} alpha(0)")
set(button_100x50 "${button} bounds(2, 2, 96, 46)")
set(checkbox_30x30 "${checkbox} bounds(5, 5, ${20_square})")
set(checkbox_30x30_background "${_checkbox_background} bounds(0, 0, ${30_square})")
set(checkbox_50x50 "${checkbox} bounds(5, 5, ${40_square})")
set(checkbox_50x50_background "${_checkbox_background} bounds(0, 0, ${50_square})")
set(checkbox_100x100 "${checkbox} bounds(5, 5, ${90_square})")
set(checkbox_100x100_background "${_checkbox_background} bounds(0, 0, ${100_square})")
set(combobox_100x50 "${combobox} bounds(0, 10, 100, 30) value(1)")
set(combobox_200x50 "${combobox} bounds(0, 10, 200, 30) value(1)")
set(combobox_250x50 "${combobox} bounds(0, 10, 250, 30) value(1)")
set(combobox_500x50 "${combobox} bounds(0, 10, 500, 30) value(1)")
set(knob_50x50 "${rslider_small} bounds(-15, 0, 80, 70) valuetextbox(1)")
set(knob_100x100 "${rslider} bounds(10, 10, 80, 80) valuetextbox(1)")
set(knob_200x200 "${rslider} bounds(20, 20, 160, 160) valuetextbox(1)")
set(label_50x50_10px "${label} bounds(5, 5, 40, 10)")
set(label_50x50_20px "${label} bounds(5, 5, 40, 20)")
set(label_100x50_10px "${label} bounds(5, 5, 90, 10)")
set(label_100x50_15px "${label} bounds(5, 5, 90, 15)")
set(label_100x50_15px_vcenter "${label} bounds(5, 17.5, 90, 15)")
set(label_100x50_20px "${label} bounds(5, 5, 90, 20)")

# CMake widget group functions.

set(adsr_range_0_to_1 "${range_0_to_1}")
set(adsr_range_0_to_10 "${range_0_to_10}")
set(adsr_range_minus_1_to_1 "${range_minus_1_to_1}")

macro(add_adsr_200x100)
    set(variableName ${ARGV0})
    set(AdsrChannelPrefix ${ARGV1})
    set(outputFileName "${CSD_CONFIGURED_FILES_DIR}/${InstrumentName}.${AdsrChannelPrefix}.adsr_200x100.ui")
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget_groups/adsr_200x100.ui" "${outputFileName}")
    set(${variableName} "${outputFileName}")
endmacro()

macro(add_lfo_200x100)
    set(variableName ${ARGV0})
    set(LfoChannelPrefix ${ARGV1})
    set(outputFileName "${CSD_CONFIGURED_FILES_DIR}/${InstrumentName}.${LfoChannelPrefix}.lfo_200x100.ui")
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget_groups/lfo_200x100.ui" "${outputFileName}")
    set(${variableName} "${outputFileName}")
endmacro()

macro(add_xypad_50x300_y)
    set(variableName ${ARGV0})
    set(XYPadChannelPrefix ${ARGV1})
    set(XYPadXAxisY ${ARGV2})
    set(XYPadRange ${ARGV3})
    set(XYPadColor ${ARGV4})

    if(XYPadXAxisY EQUAL 0)
        set(XYPadXAxisVisible 0)
    elseif(XYPadXAxisY EQUAL 300)
        set(XYPadXAxisVisible 0)
    else()
        set(XYPadXAxisVisible 1)
    endif()
    set(XYPadXAxisY MATH "(300 - ${XYPadXAxisY}) - 1")

    set(outputFileName "${CSD_CONFIGURED_FILES_DIR}/${InstrumentName}.${XYPadChannelPrefix}.xypad_50x300_y.ui")
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget_groups/xypad_50x300_y.ui" "${outputFileName}")
    set(${variableName} "${outputFileName}")
endmacro()

macro(add_xypad_200x200)
    set(variableName ${ARGV0})
    set(XYPadChannelPrefix ${ARGV1})
    set(XYPadType ${ARGV2})
    set(XYPadColor ${ARGV3})

    if(XYPadType STREQUAL "Cartesian")
        set(XYPadCornerRadius 0)
    elseif(XYPadType STREQUAL "Polar")
        set(XYPadCornerRadius 100)
    else()
        message(SEND_ERROR "Unknown XYPad type ${XYPadType}")
    endif()

    set(outputFileName "${CSD_CONFIGURED_FILES_DIR}/${InstrumentName}.${XYPadChannelPrefix}.xypad_200x200.ui")
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget_groups/xypad_200x200.ui" "${outputFileName}")
    set(${variableName} "${outputFileName}")
endmacro()

macro(add_xypad_300x300)
    set(variableName ${ARGV0})
    set(XYPadChannelPrefix ${ARGV1})
    set(XYPadType ${ARGV2})
    set(XYPadColor ${ARGV3})

    if(XYPadType STREQUAL "Cartesian")
        set(XYPadCornerRadius 0)
    elseif(XYPadType STREQUAL "Polar")
        set(XYPadCornerRadius 150)
    else()
        message(SEND_ERROR "Unknown XYPad type ${XYPadType}")
    endif()

    set(outputFileName "${CSD_CONFIGURED_FILES_DIR}/${InstrumentName}.${XYPadChannelPrefix}.xypad_300x300.ui")
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget_groups/xypad_300x300.ui" "${outputFileName}")
    set(${variableName} "${outputFileName}")
endmacro()

#=======================================================================================================================

if(Cabbage_LogCabbageOutput)
    set(form "${form} logger(1)")
endif()

if(Cabbage_UiOutlineGroups)
    set(group "${group} outlinecolour(${light_blue}, 128) outlinethickness(2)")
endif()

function(configure_source_file)
    set(file "${ARGV0}")
    get_filename_component(file_name "${file}" NAME)
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/${file}" "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${file_name}")
endfunction()

foreach(header_file ${CsoundCMake_Cabbage_HeaderFiles})
    configure_source_file("${header_file}")
endforeach()

foreach(orc_file ${CsoundCMake_Cabbage_OrcFiles})
    configure_source_file("${orc_file}")
endforeach()

if(NOT ${Build_InlineIncludes} EQUAL ON)
    foreach(orc_file ${CsoundCMake_Cabbage_OrcFiles})
        get_filename_component(orc_file_name "${orc_file}" NAME)
        get_dependencies(orc_file_dependencies "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${orc_file_name}")
        add_preprocess_file_command(
            "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${orc_file_name}"
            "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${orc_file_name}"
            DEPENDS ${orc_file_dependencies}
        )
        list(APPEND CsoundCMake_Cabbage_Dependencies "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${orc_file_name}")
    endforeach()
endif()

add_custom_target(CsoundCMake.Cabbage ALL DEPENDS ${CsoundCMake_Cabbage_Dependencies} CsoundCMake.Core)

mark_as_advanced(FORCE CsoundCMake.Cabbage_DIR)
