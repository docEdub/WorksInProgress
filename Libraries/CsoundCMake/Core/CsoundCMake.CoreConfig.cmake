
include_guard()

include("${CsoundCMake.Core_DIR}/Source/functions/add_preprocess_file_command.cmake")
include("${CsoundCMake.Core_DIR}/Source/functions/add_run_csound_command.cmake")
include("${CsoundCMake.Core_DIR}/Source/functions/get_dependencies.cmake")
include("${CsoundCMake.Core_DIR}/Source/global.cmake")

add_custom_target(${PROJECT_NAME})

set(CsoundCMake_Core_HeaderFiles
    "core_global.h"
    "core_options.h"
    "definitions.h"
    "instrument_orc_definitions.h"
)

set(CsoundCMake_Core_OrcFiles
    "af_global.orc"
    "af_opcodes.orc"
    "af_spatial_opcodes.orc"
    "af_spatial_tables.orc"
    "core_global.orc"
    "core_instr_1_head.orc"
    "instrument_cc.orc"
    "log.orc"
    "log.orc.h"
    "math.orc"
    "string.orc"
    "time.orc"
)

# Override the CMake `set` function to allow defining cache variables without having to set a description string, and to
# add a MATH option to use instead of CMake's `math(EXPR ...)` nomenclature.
macro(set)
    if("MATH" STREQUAL "${ARGV1}")
        math(EXPR ${ARGV0} "${ARGV2}")
    elseif("CACHE" STREQUAL "${ARGV2}")
        if(${ARGC} LESS 5)
            _set(${ARGV} "")
        else()
            _set(${ARGV})
        endif()
    else()
        _set(${ARGV})
    endif()
endmacro()

set(Build_InlineIncludes OFF CACHE BOOL)
if("${BUILD_PLAYBACK_CSD}" STREQUAL "ON" OR "${FOR_PLAYBACK_CSD}" STREQUAL "ON")
    set(Build_InlineIncludes ON)
endif()
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

function(configure_source_file)
    set(file "${ARGV0}")
    configure_file("${CsoundCMake.Core_DIR}/Source/${file}" "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${file}")
endfunction()

foreach(header_file ${CsoundCMake_Core_HeaderFiles})
    configure_source_file("${header_file}")
endforeach()

foreach(orc_file ${CsoundCMake_Core_OrcFiles})
    configure_source_file("${orc_file}")
endforeach()

set(PREPROCESSOR_INCLUDE_DIR ${CSOUND_CMAKE_CONFIGURED_FILES_DIR})

# Set the CMAKE_C_COMPILER_ID variable manually on macOS. I don't know why it's not getting set anymore.
if(NOT DEFINED CMAKE_C_COMPILER_ID)
    if(APPLE)
        set(CMAKE_C_COMPILER_ID "AppleClang")
    endif()
endif()

# Set the COMPILER_FORCED flags to make CMake skip the compiler check that's failing on macOS, which is probably a bug.
# It used to work fine without these flags being set.
if(APPLE)
    set(CMAKE_C_COMPILER_FORCED ON)
    set(CMAKE_CXX_COMPILER_FORCED ON)
endif()

if(NOT ${Build_InlineIncludes} EQUAL ON)
    foreach(orc_file ${CsoundCMake_Core_OrcFiles})
        add_preprocess_file_command(
            "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${orc_file}"
            "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${orc_file}"
        )
        list(APPEND CsoundCMake_Core_Dependencies "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${orc_file}")
    endforeach()
endif()

add_custom_target(CsoundCMake.Core ALL DEPENDS ${CsoundCMake_Core_Dependencies})

function(get_generated_csd_dirs configured_files_dir preprocessed_files_dir source_csd_path)
    get_filename_component(source_csd_name_we "${source_csd_path}" NAME_WE)
    get_filename_component(source_dir "${source_csd_path}" DIRECTORY)
    string(REPLACE "${CMAKE_SOURCE_DIR}" "" source_dir "${source_dir}")
    set(relative_dir "${source_dir}/${source_csd_name_we}")
    set(${configured_files_dir} "${CSOUND_CMAKE_CONFIGURED_FILES_DIR}/${relative_dir}" PARENT_SCOPE)
    set(${preprocessed_files_dir} "${CSOUND_CMAKE_PREPROCESSED_FILES_DIR}/${relative_dir}" PARENT_SCOPE)
endfunction()

function(get_generated_file_paths configured_file_path preprocessed_file_path source_csd_path source_file_path)
    get_filename_component(source_file_name "${source_file_path}" NAME)
    get_generated_csd_dirs(configured_files_dir preprocessed_files_dir "${source_csd_path}")
    set(${configured_file_path} "${configured_files_dir}/${source_file_name}" PARENT_SCOPE)
    set(${preprocessed_file_path} "${preprocessed_files_dir}/${source_file_name}" PARENT_SCOPE)
endfunction()

function(add_csd_implementation)
    set(csd "${ARGV0}")

    set(options OPTIONS)
    set(one_value_keywords ONE_VALUE_KEYWORDS)
    set(multi_value_keywords DEPENDS)
    cmake_parse_arguments(ARG "${options}" "${one_value_keywords}" "${multi_value_keywords}" ${ARGN})

    if(ARG_DEPENDS STREQUAL "")
        set(ARG_DEPENDS CsoundCMake)
    endif()

    get_filename_component(csd_dir "${csd}" DIRECTORY)
    get_filename_component(csd_without_extension "${csd}" NAME_WE)

    # Clear CSD_DEPENDS variable before including .cmake files.
    set(CSD_DEPENDS "")

    # If a .cmake file with the same name as the given csd exists, include it before configuring the csd.
    set(csd_cmake "${CMAKE_CURRENT_LIST_DIR}/${csd_dir}/${csd_without_extension}.cmake")
    if (EXISTS "${csd_cmake}")
        include("${csd_cmake}")
    endif()

    # If a .orc file with the same name as the given csd exists, configure and preprocess it.
    set(orc "${CMAKE_CURRENT_LIST_DIR}/${csd_dir}/${csd_without_extension}.orc")
    if (EXISTS "${orc}")
        get_generated_file_paths(orc_configured orc_preprocessed "${csd}" "${orc}")
        configure_file("${orc}" "${orc_configured}")
        if(NOT ${Build_InlineIncludes} EQUAL ON)
            get_dependencies(dependencies "${orc_configured}")
            message("orc_configured = ${orc_configured}")
            add_preprocess_file_command(
                "${orc_configured}"
                "${orc_preprocessed}"
                DEPENDS
                    ${ARG_DEPENDS}
                    ${dependenices}
            )

            list(APPEND ARG_DEPENDS "${orc_preprocessed}")
        endif()
    endif()

    # Add dependencies injected by included .cmake files.
    if(DEFINED CSD_DEPENDS)
        list(APPEND ARG_DEPENDS ${CSD_DEPENDS})
    endif()

    # Configure the given csd.
    get_generated_file_paths(csd_configured csd_preprocessed "${csd}" "${csd}")
    configure_file("${csd}" "${csd_configured}")

    # Get the configured csd's dependencies.
    get_dependencies(dependencies "${csd_configured}")

    # Add the command to preprocess the given csd.
    get_filename_component(csd_file_name "${csd}" NAME)
    add_preprocess_file_command(
        "${csd_configured}"
        "${CSOUND_CMAKE_PLUGIN_OUTPUT_DIR}/${csd_file_name}"
        DEPENDS
            ${ARG_DEPENDS}
            ${dependencies}
        )
endfunction()

function(add_csd)
    add_csd_implementation(${ARGN} DEPENDS CsoundCMake.Core)
endfunction()
