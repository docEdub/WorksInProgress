
include_guard()

include("${CsoundCMake.Core_DIR}/Source/functions/add_preprocess_file_target.cmake")
include("${CsoundCMake.Core_DIR}/Source/functions/add_run_csound_command.cmake")
include("${CsoundCMake.Core_DIR}/CsoundCMake.CoreCommon.cmake")
include("${CsoundCMake.Core_DIR}/Source/global.cmake")

add_custom_target(${PROJECT_NAME})

# Override the CMake `set` function to mark variables as non-advanced and allow defining cache variables without having
# to set a description string.
macro(set)
    if("MATH" STREQUAL "${ARGV1}")
        math(EXPR ${ARGV0} "${ARGV2}")
    elseif("CACHE" STREQUAL "${ARGV2}")
        if(${ARGC} LESS 5)
            _set(${ARGV} "")
        else()
            _set(${ARGV})
        endif()
        mark_as_advanced(CLEAR ${ARGV0})
    else()
        _set(${ARGV})
    endif()
endmacro()

# Mark all variables as advanced. The variables we define will be set back to non-advanced by the overridden `set`
# function.
function(mark_all_variables_as_advanced)
    get_cmake_property(variables VARIABLES)
    mark_as_advanced(FORCE ${variables})
endfunction()
mark_all_variables_as_advanced()

set(Build_InlineIncludes OFF CACHE BOOL)
if(Build_InlineIncludes)
    set(CSOUND_INCLUDE "#include")
    set(CSOUND_INCLUDE_GUARD_DEFINE "#define")
    set(CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION "")
    set(CSOUND_INCLUDE_GUARD_ENDIF "#endif")
    set(CSOUND_INCLUDE_GUARD_IFNDEF "#ifndef")
else()
    set(CSOUND_INCLUDE "CSOUND_INCLUDE")
    set(CSOUND_INCLUDE_GUARD_DEFINE "_(HASH)_(define)")
    set(CSOUND_INCLUDE_GUARD_DEFINE_DEFINITION "_(HASH)_(HASH)")
    set(CSOUND_INCLUDE_GUARD_ENDIF "_(HASH)_(end)")
    set(CSOUND_INCLUDE_GUARD_IFNDEF "_(HASH)_(ifndef)")
endif()

set(CsoundLog_FileNames OFF CACHE BOOL)
set(CsoundLog_Level0Trace OFF CACHE BOOL)
set(CsoundLog_Level1Debug OFF CACHE BOOL)
set(CsoundLog_Level2Info OFF CACHE BOOL)
set(CsoundLog_Level3Warning OFF CACHE BOOL)
set(CsoundLog_Level4Error OFF CACHE BOOL)
set(CsoundLog_Level5Fatal OFF CACHE BOOL)
set(CsoundLog_ToCsoundOutput OFF CACHE BOOL)
set(CsoundLog_ToDawService OFF CACHE BOOL)

set(CsoundMessages_NoteAmplitudes ON CACHE BOOL)
set(CsoundMessages_SamplesOutOfRange ON CACHE BOOL)
set(CsoundMessages_Warnings ON CACHE BOOL)
set(CsoundMessages_Benchmarks ON CACHE BOOL)
set(CsoundMessages_DeprecationWarnings ON CACHE BOOL)

set(CSOUND_MESSAGE_LEVEL 0)
if(${CsoundMessages_NoteAmplitudes})
    set(CSOUND_MESSAGE_LEVEL MATH "${CSOUND_MESSAGE_LEVEL} + 1")
endif()
if(${CsoundMessages_SamplesOutOfRange})
    set(CSOUND_MESSAGE_LEVEL MATH "${CSOUND_MESSAGE_LEVEL} + 2")
endif()
if(${CsoundMessages_Warnings})
    set(CSOUND_MESSAGE_LEVEL MATH "${CSOUND_MESSAGE_LEVEL} + 4")
endif()
if(${CsoundMessages_Benchmarks})
    set(CSOUND_MESSAGE_LEVEL MATH "${CSOUND_MESSAGE_LEVEL} + 128")
endif()
if(NOT ${CsoundMessages_DeprecationWarnings})
    set(CSOUND_MESSAGE_LEVEL MATH "${CSOUND_MESSAGE_LEVEL} + 1024")
endif()

# This are not needed. They are added for consistency with ${CSOUND_INCLUDE} in .csd files.
set(CSOUND_DEFINE "CSOUND_DEFINE")
set(CSOUND_ELSE "CSOUND_ELSE")
set(CSOUND_ENDIF "CSOUND_ENDIF")
set(CSOUND_IFDEF "CSOUND_IFDEF")
set(CSOUND_IFNDEF "CSOUND_IFNDEF")
set(CSOUND_UNDEF "CSOUND_UNDEF")

configure_file("${CsoundCMake.Core_DIR}/Source/core_global.h" "${CSOUND_CMAKE_OUTPUT_DIR}/core_global.h")
configure_file("${CsoundCMake.Core_DIR}/Source/core_options.h" "${CSOUND_CMAKE_OUTPUT_DIR}/core_options.h")
configure_file("${CsoundCMake.Core_DIR}/Source/definitions.h" "${CSOUND_CMAKE_OUTPUT_DIR}/definitions.h")
configure_file("${CsoundCMake.Core_DIR}/Source/instrument_orc_definitions.h"
    "${CSOUND_CMAKE_OUTPUT_DIR}/instrument_orc_definitions.h")

foreach(orc_file ${ORC_FILES})
    configure_file("${CsoundCMake.Core_DIR}/Source/${orc_file}" "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${orc_file}")
endforeach()

if(${Build_InlineIncludes})
    set(PREPROCESSOR_INCLUDE_DIR_1 ${CSOUND_CMAKE_CONFIGURED_FILES_DIR})
    set(PREPROCESSOR_INCLUDE_DIR_2 ${CSOUND_CMAKE_OUTPUT_DIR})
else()
    set(PREPROCESSOR_INCLUDE_DIR_1 "${CSOUND_CMAKE_OUTPUT_DIR}")
    set(PREPROCESSOR_INCLUDE_DIR_2 ".")
endif()

add_custom_target(CsoundCMake ALL COMMAND ${CMAKE_COMMAND} -DCMAKE_C_COMPILER=\"${CMAKE_C_COMPILER}\"
    -DPREPROCESSOR_INCLUDE_DIR_1=\"${PREPROCESSOR_INCLUDE_DIR_1}\"
    -DPREPROCESSOR_INCLUDE_DIR_2=\"${PREPROCESSOR_INCLUDE_DIR_2}\"
    -DCMAKE_C_COMPILER_ID=\"${CMAKE_C_COMPILER_ID}\" -DCsoundCMake.Core_DIR=\"${CsoundCMake.Core_DIR}\"
    -P "${CsoundCMake.Core_DIR}/CsoundCMake.CoreTarget.cmake" WORKING_DIRECTORY "${CMAKE_SOURCE_DIR}"
)

function(add_csd_implementation)
    set(csd "${ARGV0}")
    message(STATUS "Adding csd \"${csd}\"")

    set(options OPTIONS)
    set(one_value_keywords ONE_VALUE_KEYWORDS)
    set(multi_value_keywords DEPENDS)
    cmake_parse_arguments(ARG "${options}" "${one_value_keywords}" "${multi_value_keywords}" ${ARGN})

    if(ARG_DEPENDS STREQUAL "")
        set(ARG_DEPENDS CsoundCMake)
    endif()

    get_filename_component(csd_without_extension "${csd}" NAME_WE)

    # Clear CSD_DEPENDS variable before including .cmake files.
    set(CSD_DEPENDS "")

    # If a .cmake file with the same name as the given csd exists, include it before configuring the csd.
    set(csd_cmake "${CMAKE_CURRENT_LIST_DIR}/${csd_without_extension}.cmake")
    if (EXISTS "${csd_cmake}")
        message(STATUS "Found \"${csd_without_extension}.cmake\"")
        include("${csd_cmake}")
    endif()

    # If a .orc file with the same name as the given csd exists, configure and preprocess it.
    set(orc "${CMAKE_CURRENT_LIST_DIR}/${csd_without_extension}.orc")
    if (EXISTS "${orc}")
        message(STATUS "Found \"${csd_without_extension}.orc\"")
        set(orc_configured "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${csd_without_extension}.orc")
        set(orc_preprocessed "${CSOUND_CMAKE_OUTPUT_DIR}/${csd_without_extension}.orc")
        configure_file("${orc}" "${orc_configured}")
        add_preprocess_file_target("${orc_configured}" "${orc_preprocessed}" DEPENDS ${ARG_DEPENDS})
    endif()

    # Add dependencies injected by included .cmake files.
    if(DEFINED CSD_DEPENDS)
        list(APPEND ARG_DEPENDS ${CSD_DEPENDS})
    endif()

    # Configure and preprocess the given csd.
    set(csd_configured "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${csd_without_extension}.csd")
    set(csd_preprocessed "${CSOUND_CMAKE_OUTPUT_DIR}/${csd_without_extension}.csd")
    configure_file("${csd}" "${csd_configured}")
    add_preprocess_file_target("${csd_configured}" "${csd_preprocessed}" DEPENDS ${ARG_DEPENDS})
endfunction()

function(add_csd)
    add_csd_implementation(${ARGN} DEPENDS CsoundCMake)
endfunction()
