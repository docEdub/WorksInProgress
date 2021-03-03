
include_guard()

set(_CsoundCMake.Cabbage_DIR "${CsoundCMake.Cabbage_DIR}")
LIST(APPEND CMAKE_PREFIX_PATH "${ROOT_DIR}/Libraries/CsoundCMake/Core")
find_package(CsoundCMake.Core REQUIRED)
set(CsoundCMake.Cabbage_DIR "${CsoundCMake.Cabbage_DIR}" CACHE STRING)
mark_as_advanced(FORCE CsoundCMake.Cabbage_DIR)
unset(_CsoundCMake.Cabbage_DIR)

if(APPLE)
    set(CABBAGE_PATH "/Applications/Cabbage.app" CACHE STRING)
elseif(WIN32)
    set(CABBAGE_PATH "C:\\Program Files\\Cabbage\\current\\Cabbage.exe" CACHE STRING)
endif()

set(BuildPlugin_AU_Export OFF CACHE BOOL)
set(BuildPlugin_AU_LinkCsdFiles OFF CACHE BOOL)
set(BuildPlugin_VST3_Export OFF CACHE BOOL)
set(BuildPlugin_VST3_LinkCsdFiles OFF CACHE BOOL)

set(Cabbage_LogCabbageOutput OFF CACHE BOOL)
set(Cabbage_UiGrid OFF CACHE BOOL)
set(Cabbage_UiOutlineGroups OFF CACHE BOOL)


include("${CsoundCMake.Cabbage_DIR}/CsoundCMake.CabbageCommon.cmake")

function(add_csd)
    add_csd_implementation(${ARGN} DEPENDS CsoundCMake.Cabbage)
endfunction()

function(export_csd_plugin)
    add_csd("${ARGV0}")

    set(in_file "${ARGV0}")

    set(au_plugin_type "AU")
    set(vst3_plugin_type "VST3")
    if("${ARGV1}" STREQUAL "synth")
        set(au_plugin_type "${au_plugin_type}i")
        set(vst3_plugin_type "${vst3_plugin_type}i")
    endif()

    if(APPLE)
        get_filename_component(in_file_name "${in_file}" NAME)
        get_filename_component(in_file_name_we "${in_file}" NAME_WE)

        set(preprocess_target "preprocess_${in_file_name_we}_csd")

        # Set AU plugin variables.
        set(export_plugin_target "export_${in_file_name}_au_plugin")
        set(plugin_dir "~/Library/Audio/Plug-Ins/Components")
        set(plugin_path "${plugin_dir}/${in_file_name_we}.component")
        
        if(BuildPlugin_AU_Export)
            # Export AU component to ~/Library/Audio/Plug-Ins/Components.
            add_custom_target("${export_au_plugin_target}" ALL DEPENDS ${preprocess_target} CsoundCMake.Cabbage COMMAND
                rm -rf "${plugin_path}" || true && "${CABBAGE_PATH}/Contents/MacOS/Cabbage" --export-${au_plugin_type}
                "${CSOUND_CMAKE_OUTPUT_DIR}/${in_file}" --destination "${plugin_path}")
            set(link_target_depends ${export_plugin_target})
        else()
            set(link_target_depends ${preprocess_target} CsoundCMake.Cabbage)
        endif()

        if(BuildPlugin_AU_LinkCsdFiles)
            # Make hard link for .csd in ~/Library/Audio/Plug-Ins/Components so Cabbage plugins can find them.
            set(link_target "link_${in_file_name}_au")
            set(plugin_contents_dir "${plugin_path}/Contents")
            set(plugin_csd_path "${plugin_contents_dir}/CabbagePlugin.csd")
            add_custom_target("${link_target}" ALL DEPENDS ${link_target_depends} COMMAND
                rm ${plugin_csd_path} || true && ln ${CSOUND_CMAKE_OUTPUT_DIR}/${in_file} ${plugin_csd_path} || true)
        endif()
        
        # Set VST3 plugin variables.
        set(export_plugin_target "export_${in_file_name}_vst3_plugin")
        set(plugin_dir "${CSOUND_CMAKE_OUTPUT_DIR}")
        set(plugin_path "${plugin_dir}/${in_file_name_we}.vst3")
        
        if(BuildPlugin_VST3_Export)
            # Export VST3 plugin to "${CSOUND_CMAKE_OUTPUT_DIR}".
            add_custom_target("${export_plugin_target}" ALL DEPENDS ${preprocess_target} CsoundCMake.Cabbage COMMAND
                rm -rf "${plugin_path}" || true && "${CABBAGE_PATH}/Contents/MacOS/Cabbage" --export-${vst3_plugin_type}
                "${CSOUND_CMAKE_OUTPUT_DIR}/${in_file}" --destination "${plugin_path}")
            set(link_target_depends ${export_plugin_target})
        else()
            set(link_target_depends ${preprocess_target} CsoundCMake.Cabbage)
        endif()

        if(BuildPlugin_VST3_LinkCsdFiles)
            # Make hard link for .csd in ~/Library/Audio/Plug-Ins/Components so Cabbage plugins can find them.
            set(link_target "link_${in_file_name}")
            set(plugin_contents_dir "${plugin_path}/Contents")
            set(plugin_csd_path "${plugin_contents_dir}/${in_file_name}")
            add_custom_target("${link_target}" ALL DEPENDS ${link_target_depends} COMMAND
                rm ${plugin_csd_path} || true && ln ${CSOUND_CMAKE_OUTPUT_DIR}/${in_file} ${plugin_csd_path} || true)
        endif()
    endif()

endfunction()

function(add_csd_effect)
    export_csd_plugin("${ARGV0}" "effect")
endfunction()

function(add_csd_synth)
    export_csd_plugin("${ARGV0}" "synth")
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
set(csoundoutput "csoundoutput style(\"monospaced\")")
set(form "form")
set(group "image colour(${dark_grey}, ${group_alpha})")
set(hslider "hslider ${_linear_slider} popuptext(0)")
set(keyboard "keyboard")
set(label "label corners(0) fontstyle(\"plain\")")
set(rect "image")
set(rslider "rslider ${_radial_slider} trackerinsideradius(0.999) trackercolour(${dark_grey}) markerstart(0) markerthickness(100)")
set(rslider_small "rslider ${_radial_slider} trackerinsideradius(0.499) trackeroutsideradius(0.500) trackercolour(${dark_grey}) markerstart(0) markerthickness(100)")
set(texteditor "texteditor")
set(vslider "vslider ${_linear_slider} popuptext(0)")
set(xypad "xypad")

# Public attributes
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
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget-groups/adsr_200x100.ui"
        "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/adsr_200x100.ui-tmp")
    file(READ "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/adsr_200x100.ui-tmp" ${variableName})
endmacro()

macro(add_lfo_200x100)
    set(variableName ${ARGV0})
    set(LfoChannelPrefix ${ARGV1})
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget-groups/lfo_200x100.ui"
        "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/lfo_200x100.ui-tmp")
    file(READ "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/lfo_200x100.ui-tmp" ${variableName})
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

    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget-groups/xypad_50x300_y.ui"
        "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/xypad_50x300_y.ui-tmp")
    file(READ "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/xypad_50x300_y.ui-tmp" ${variableName})
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

    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget-groups/xypad_200x200.ui"
        "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/xypad_200x200.ui-tmp")
    file(READ "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/xypad_200x200.ui-tmp" ${variableName})
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

    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/widget-groups/xypad_300x300.ui"
        "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/xypad_300x300.ui-tmp")
    file(READ "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/xypad_300x300.ui-tmp" ${variableName})
endmacro()

#=======================================================================================================================

if(Cabbage_LogCabbageOutput)
    set(form "${form} logger(1)")
endif()

if(Cabbage_UiOutlineGroups)
    set(group "${group} outlinecolour(${light_blue}, 128) outlinethickness(2)")
endif()

configure_file("${CsoundCMake.Cabbage_DIR}/Source/cabbage_core_global.h"
    "${CSOUND_CMAKE_OUTPUT_DIR}/cabbage_core_global.h")
configure_file("${CsoundCMake.Cabbage_DIR}/Source/cabbage_effect_global.h"
    "${CSOUND_CMAKE_OUTPUT_DIR}/cabbage_effect_global.h")
configure_file("${CsoundCMake.Cabbage_DIR}/Source/cabbage_synth_global.h"
    "${CSOUND_CMAKE_OUTPUT_DIR}/cabbage_synth_global.h")

foreach(orc_file ${ORC_FILES})
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/${orc_file}" "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${orc_file}")
endforeach()

add_custom_target(CsoundCMake.Cabbage ALL DEPENDS CsoundCMake COMMAND ${CMAKE_COMMAND}
    -DPREPROCESSOR_INCLUDE_DIR_1=\"${PREPROCESSOR_INCLUDE_DIR_1}\"
    -DPREPROCESSOR_INCLUDE_DIR_2=\"${PREPROCESSOR_INCLUDE_DIR_2}\"
    -DCMAKE_C_COMPILER=\"${CMAKE_C_COMPILER}\"
    -DCMAKE_C_COMPILER_ID=\"${CMAKE_C_COMPILER_ID}\"
    -DCsoundCMake_Core_DIR=\"${CsoundCMake_Core_DIR}\"
    -DCsoundCMake.Cabbage_DIR=\"${CsoundCMake.Cabbage_DIR}\"
    -P "${DCsoundCMake.Cabbage_DIR}/CsoundCMake.CabbageTarget.cmake"
    WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
)
