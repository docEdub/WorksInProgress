
include("${CsoundCMake.Cabbage_DIR}/Source/global.cmake")

set(tab_padding 4)
set(tab_height 26)

set(tab_index 0)
set(next_tab_x ${tab_padding})

set(tab_channels "")

macro(add_tab)
    set(tab_variable ${ARGV0})
    set(tab_label "${ARGV1}")
    set(tab_width ${ARGV2})

    set(${tab_variable}_x ${next_tab_x})
    set(${tab_variable}_y 0)
    set(${tab_variable}_width ${tab_width})
    set(${tab_variable}_height ${tab_height})

    set(${tab_variable}_xy "${${tab_variable}_x}, ${${tab_variable}_y}")
    set(${tab_variable}_size "${${tab_variable}_width}, ${${tab_variable}_height}")
    set(${tab_variable}_rect "${${tab_variable}_xy}, ${${tab_variable}_size}")

    # Append tab to Tab.ui.tmp.
    set(tab_ui_path "${CSD_CONFIGURED_FILES_DIR}/Tab.ui.tmp")
    # If this is first tab, clear Tab.ui.tmp contents.
    if(${tab_index} EQUAL 0)
        file(WRITE "${tab_ui_path}" "")
    endif()
    file(APPEND "${tab_ui_path}" "${button}")
    file(APPEND "${tab_ui_path}" " automatable(0)")
    file(APPEND "${tab_ui_path}" " bounds(${${tab_variable}_rect})")
    file(APPEND "${tab_ui_path}" " text(\"${tab_label}\")")
    file(APPEND "${tab_ui_path}" " channel(\"${tab_variable}\") identchannel(\"${tab_variable}_ui\")")
    file(APPEND "${tab_ui_path}" " radiogroup(\"tabs\") ${dark_blue_radiogroup_colors}")
    if(${tab_index} EQUAL 1)
        file(APPEND "${tab_ui_path}" " value(1)")
    endif()
    file(APPEND "${tab_ui_path}" "\n")

    # Update variables for next tab.
    set(tab_index MATH "${tab_index} + 1")
    set(next_tab_x MATH "${next_tab_x} + ${${tab_variable}_width} + ${tab_padding}")

    # Update 'tab_channels' variable used in Tab.orc.
    list(APPEND tab_channels "${tab_variable}")
endmacro()

macro(process_tabs)
    set(tab_ui_path "${CSD_CONFIGURED_FILES_DIR}/Tab.ui")
    set(tab_ui_path_tmp "${tab_ui_path}.tmp")
    execute_process(COMMAND ${CMAKE_COMMAND} -E copy_if_different "${tab_ui_path_tmp}" "${tab_ui_path}")

    string(REPLACE ";" "\", \"" csound_tab_channels "\"${tab_channels}\"")
    configure_file("${CsoundCMake.Cabbage_DIR}/Source/ui/Tab.orc" "${CSD_CONFIGURED_FILES_DIR}/Tab.orc")

    if(NOT ${Build_InlineIncludes} EQUAL ON)
        get_dependencies(dependencies "${CSD_CONFIGURED_FILES_DIR}/Tab.orc")
        add_preprocess_file_command("${CSD_CONFIGURED_FILES_DIR}/Tab.orc" "${CSD_PREPROCESSED_FILES_DIR}/Tab.orc"
            DEPENDS CsoundCMake.Cabbage ${dependencies}
            )

        # Add this file's preprocessed file to the .csd file's preprocess target's dependencies.
        # See CsoundCMakeConfig.cmake.
        list(APPEND CSD_DEPENDS "${CSD_PREPROCESSED_FILES_DIR}/Tab.orc")
    endif()
endmacro()

# Cabbage has an issue causing the first tab button to fail almost all the time. To work around it, add a dummy tab with
# zero width so it can't be seen.
add_tab(first_tab_bug_workaround_tab "" 0)
set(tab_channels "")