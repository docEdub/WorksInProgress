
#ifndef CsoundCMake_definitions_h
#define CsoundCMake_definitions_h

#include "csound_definitions.h"

#define false 0
#define true 1

#define OFF 0
#define ON 1

#define HASH #
#define _(x) x

#define _CONCAT(a, b) a ## b
#define CONCAT(a, b) _CONCAT(a, b)

#define _STRINGIZE(x) #x
#define STRINGIZE(x) _STRINGIZE(x)

#define FLOAT_MIN 0.000001

#define PI 3.141592653589793
#define TWO_PI 6.283185307179586

#define GEN06 6

#define TABLEI_RAW_INDEX_MODE 0
#define TABLEI_NORMALIZED_INDEX_MODE 1

#define CSOUND_DEFINE _(HASH)_(define)
#define CSOUND_ELSE _(HASH)_(else)
#define CSOUND_ENDIF _(HASH)_(end)
#define CSOUND_IFDEF _(HASH)_(ifdef)
#define CSOUND_IFNDEF _(HASH)_(ifndef)
#define CSOUND_INCLUDE _(HASH)_(include)
#define CSOUND_UNDEF _(HASH)_(undef)

#define CABBAGE_CHANNEL_INIT_TIME_SECONDS 0.25

#define return igoto endin

#define string_i(x) x
#define string_k(x) sprintfk("%s", x)

#define DAW_SERVICE_OSC_ADDRESS "127.0.0.1"
#define DAW_SERVICE_OSC_PORT 7770
#define DAW_SERVICE_OSC_SCORE_GENERATION_PORT 7771
#define DAW_SERVICE_OSC_LOG_MESSAGE_PATH "/DawService/message/logging"
#define DAW_SERVICE_OSC_SCORE_GENERATION_PATH "/DawService/score/generation"
#define DAW_SERVICE_OSC_TRACK_REGISTRATION_PATH "/DawService/track/registration"
#define DAW_SERVICE_OSC_TRACK_REFERENCING_PATH "/DawService/track/referencing"
#define DAW_SERVICE_OSC_PLUGIN_REGISTRATION_PATH "/DawService/plugin/registration"
#define DAW_SERVICE_OSC_PLUGIN_REQUEST_UUID_PATH "/DawService/plugin/request_uuid"
#define DAW_SERVICE_OSC_PLUGIN_WATCH_ORC_PATH "/DawService/plugin/watch_orc"
#define DAW_SERVICE_OSC_PLUGIN_UPDATE_WATCHED_ORCS_PATH "/DawService/plugin/update_watched_orcs"

#define TRACK_INFO_OSC_ADDRESS "127.0.0.1"
#define TRACK_INFO_OSC_PORT_MIN 7772
#define TRACK_INFO_OSC_TRACK_SET_INDEX_PATH "/TrackInfo/track/set_index"
#define TRACK_INFO_OSC_PLUGIN_SET_UUID_PATH "/TrackInfo/plugin/set_uuid"
#define TRACK_INFO_OSC_PLUGIN_ORC_CHANGED_PATH "/TrackInfo/plugin/orc_changed"

#define TRACK_COUNT_MAX 1000
#define PLUGIN_COUNT_MAX 100

#define TRACK_TYPE_NONE 0 // Effect plugins use this type.
#define TRACK_TYPE_AUDIO 1
#define TRACK_TYPE_INSTRUMENT 2
#define TRACK_TYPE_BUS 3
#define TRACK_TYPE_MASTER 4

// The first 2 instruments in the playback csd are for initialization and clearing.
#define TRACK_PLAYBACK_INSTRUMENT_START_INDEX 4

#define PLUGIN_INDEX_TRACKING_DIVISOR 1000000
#define PLUGIN_INDEX_TRACKING_INDEX_TO_SIGNAL(index) (index / PLUGIN_INDEX_TRACKING_DIVISOR)
#define PLUGIN_INDEX_TRACKING_SIGNAL_TO_INDEX(signal) (signal * PLUGIN_INDEX_TRACKING_DIVISOR)

#define VOLUME_TRACKING_DIVISOR 1000000
#define VOLUME_TRACKING_SIGNAL 0.000001
#define VOLUME_TRACKING_SIGNAL_TO_VOLUME(signal) (signal * VOLUME_TRACKING_DIVISOR)

#define EVENT_ALWAYS_ON      0
#define EVENT_EFFECT_ON      1
#define EVENT_NOTE_ON        1
#define EVENT_NOTE_OFF       2
#define EVENT_NOTE_GENERATED 3
#define EVENT_CC             4
#define EVENT_NOTE_CACHE     5

#define LOG_TRACE _(${CsoundLog_Level0Trace})
#define LOG_DEBUG _(${CsoundLog_Level1Debug})
#define LOG_INFO _(${CsoundLog_Level2Info})
#define LOG_WARNING _(${CsoundLog_Level3Warning})
#define LOG_ERROR _(${CsoundLog_Level4Error})
#define LOG_FATAL _(${CsoundLog_Level5Fatal})
#define LOGGING (LOG_TO_CSOUND_OUTPUT || LOG_TO_DAW_SERVICE) && (LOG_TRACE || LOG_DEBUG || LOG_INFO || LOG_WARNING || LOG_ERROR || LOG_FATAL)

#define LOG_FILENAMES _(${CsoundLog_FileNames})
#define LOG_TO_CSOUND_OUTPUT _(${CsoundLog_ToCsoundOutput})
#define LOG_TO_DAW_SERVICE _(${CsoundLog_ToDawService})

#ifdef _MSC_VER
    #define ARGUMENT_COUNT(...)  INTERNAL_EXPAND_ARGS_PRIVATE(INTERNAL_ARGS_AUGMENTER(__VA_ARGS__))
    #define INTERNAL_ARGS_AUGMENTER(...) unused, __VA_ARGS__
    #define INTERNAL_EXPAND(x) x
    #define INTERNAL_EXPAND_ARGS_PRIVATE(...) INTERNAL_EXPAND(INTERNAL_GET_ARG_COUNT_PRIVATE(__VA_ARGS__, 69, 68, 67, \
        66, 65, 64, 63, 62, 61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, \
        39, 38, 37, 36, 35, 34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, \
        12, 11, 10, 9, 8, 7, 6, 5, 4, 3, 2, 1, 0))
    #define INTERNAL_GET_ARG_COUNT_PRIVATE(_1_, _2_, _3_, _4_, _5_, _6_, _7_, _8_, _9_, _10_, _11_, _12_, _13_, _14_, \
    _15_, _16_, _17_, _18_, _19_, _20_, _21_, _22_, _23_, _24_, _25_, _26_, _27_, _28_, _29_, _30_, _31_, _32_, _33_, \
    _34_, _35_, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, _53, _54, _55, \
    _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, count, ...) count
#else
    #define ARGUMENT_COUNT(...) INTERNAL_GET_ARG_COUNT_PRIVATE(0, ## __VA_ARGS__, 70, 69, 68, 67, 66, 65, 64, 63, 62, \
        61, 60, 59, 58, 57, 56, 55, 54, 53, 52, 51, 50, 49, 48, 47, 46, 45, 44, 43, 42, 41, 40, 39, 38, 37, 36, 35, \
        34, 33, 32, 31, 30, 29, 28, 27, 26, 25, 24, 23, 22, 21, 20, 19, 18, 17, 16, 15, 14, 13, 12, 11, 10, 9, 8, 7, \
        6, 5, 4, 3, 2, 1, 0)
    #define INTERNAL_GET_ARG_COUNT_PRIVATE(_0, _1_, _2_, _3_, _4_, _5_, _6_, _7_, _8_, _9_, _10_, _11_, _12_, _13_, \
        _14_, _15_, _16_, _17_, _18_, _19_, _20_, _21_, _22_, _23_, _24_, _25_, _26_, _27_, _28_, _29_, _30_, _31_, \
        _32_, _33_, _34_, _35_, _36, _37, _38, _39, _40, _41, _42, _43, _44, _45, _46, _47, _48, _49, _50, _51, _52, \
        _53, _54, _55, _56, _57, _58, _59, _60, _61, _62, _63, _64, _65, _66, _67, _68, _69, _70, count, ...) count
#endif

#if LOG_TRACE
    #define log_i_trace_raw(...) CONCAT(log_i_trace_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_i_trace(...) _(S_ = log_i_trace_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_i_trace_0() _log_i_trace("", __FILE__, __LINE__)
        #define log_i_trace_1(message) _log_i_trace(message, __FILE__, __LINE__)
        #define log_i_trace_N(format, ...) _log_i_trace(sprintf(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_i_trace_0() _log_i_trace("")
        #define log_i_trace_1(message) _log_i_trace(message)
        #define log_i_trace_N(format, ...) _log_i_trace(sprintf(format, ## __VA_ARGS__))
    #endif
    #define log_i_trace_2(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_3(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_4(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_5(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_6(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_7(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_8(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_9(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_10(format, ...) log_i_trace_N(format, ## __VA_ARGS__)
    #define log_i_trace_11(format, ...) log_i_trace_N(format, ## __VA_ARGS__)

    #define log_k_trace_raw(...) CONCAT(log_k_trace_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_k_trace(...) _(S_ = log_k_trace_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_k_trace_0() _log_k_trace("", __FILE__, __LINE__)
        #define log_k_trace_1(message) _log_k_trace(message, __FILE__, __LINE__)
        #define log_k_trace_N(format, ...) _log_k_trace(sprintfk(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_k_trace_0() _log_k_trace("")
        #define log_k_trace_1(message) _log_k_trace(message)
        #define log_k_trace_N(format, ...) _log_k_trace(sprintfk(format, ## __VA_ARGS__))
    #endif
    #define log_k_trace_2(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_3(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_4(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_5(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_6(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_7(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_8(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_9(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_10(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
    #define log_k_trace_11(format, ...) log_k_trace_N(format, ## __VA_ARGS__)
#else
    #define log_i_trace_raw(...)
    #define log_i_trace(...)
    #define log_k_trace_raw(...)
    #define log_k_trace(...)
#endif

#if LOG_DEBUG
    #define log_i_debug_raw(...) CONCAT(log_i_debug_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_i_debug(...) _(S_ = log_i_debug_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_i_debug_0() _log_i_debug("", __FILE__, __LINE__)
        #define log_i_debug_1(message) _log_i_debug(message, __FILE__, __LINE__)
        #define log_i_debug_N(format, ...) _log_i_debug(sprintf(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_i_debug_0() _log_i_debug("")
        #define log_i_debug_1(message) _log_i_debug(message)
        #define log_i_debug_N(format, ...) _log_i_debug(sprintf(format, ## __VA_ARGS__))
    #endif
    #define log_i_debug_2(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_3(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_4(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_5(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_6(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_7(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_8(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_9(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_10(format, ...) log_i_debug_N(format, ## __VA_ARGS__)
    #define log_i_debug_11(format, ...) log_i_debug_N(format, ## __VA_ARGS__)

    #define log_k_debug_raw(...) CONCAT(log_k_debug_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_k_debug(...) _(S_ = log_k_debug_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_k_debug_0() _log_k_debug("", __FILE__, __LINE__)
        #define log_k_debug_1(message) _log_k_debug(message, __FILE__, __LINE__)
        #define log_k_debug_N(format, ...) _log_k_debug(sprintfk(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_k_debug_0() _log_k_debug("")
        #define log_k_debug_1(message) _log_k_debug(message)
        #define log_k_debug_N(format, ...) _log_k_debug(sprintfk(format, ## __VA_ARGS__))
    #endif
    #define log_k_debug_2(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_3(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_4(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_5(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_6(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_7(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_8(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_9(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_10(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
    #define log_k_debug_11(format, ...) log_k_debug_N(format, ## __VA_ARGS__)
#else
    #define log_i_debug_raw(...)
    #define log_i_debug(...)
    #define log_k_debug_raw(...)
    #define log_k_debug(...)
#endif

#if LOG_INFO
    #define log_i_info_raw(...) CONCAT(log_i_info_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_i_info(...) _(S_ = log_i_info_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_i_info_0() _log_i_info("", __FILE__, __LINE__)
        #define log_i_info_1(message) _log_i_info(message, __FILE__, __LINE__)
        #define log_i_info_N(format, ...) _log_i_info(sprintf(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_i_info_0() _log_i_info("")
        #define log_i_info_1(message) _log_i_info(message)
        #define log_i_info_N(format, ...) _log_i_info(sprintf(format, ## __VA_ARGS__))
    #endif
    #define log_i_info_2(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_3(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_4(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_5(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_6(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_7(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_8(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_9(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_10(format, ...) log_i_info_N(format, ## __VA_ARGS__)
    #define log_i_info_11(format, ...) log_i_info_N(format, ## __VA_ARGS__)

    #define log_k_info_raw(...) CONCAT(log_k_info_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_k_info(...) _(S_ = log_k_info_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_k_info_0() _log_k_info("", __FILE__, __LINE__)
        #define log_k_info_1(message) _log_k_info(message, __FILE__, __LINE__)
        #define log_k_info_N(format, ...) _log_k_info(sprintfk(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_k_info_0() _log_k_info("")
        #define log_k_info_1(message) _log_k_info(message)
        #define log_k_info_N(format, ...) _log_k_info(sprintfk(format, ## __VA_ARGS__))
    #endif
    #define log_k_info_2(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_3(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_4(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_5(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_6(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_7(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_8(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_9(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_10(format, ...) log_k_info_N(format, ## __VA_ARGS__)
    #define log_k_info_11(format, ...) log_k_info_N(format, ## __VA_ARGS__)
#else
    #define log_i_info_raw(...)
    #define log_i_info(...)
    #define log_k_info_raw(...)
    #define log_k_info(...)
#endif

#if LOG_WARNING
    #define log_i_warning_raw(...) CONCAT(log_i_warning_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_i_warning(...) _(S_ = log_i_warning_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_i_warning_0() _log_i_warning("", __FILE__, __LINE__)
        #define log_i_warning_1(message) _log_i_warning(message, __FILE__, __LINE__)
        #define log_i_warning_N(format, ...) _log_i_warning(sprintf(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_i_warning_0() _log_i_warning("")
        #define log_i_warning_1(message) _log_i_warning(message)
        #define log_i_warning_N(format, ...) _log_i_warning(sprintf(format, ## __VA_ARGS__))
    #endif
    #define log_i_warning_2(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_3(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_4(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_5(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_6(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_7(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_8(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_9(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_10(format, ...) log_i_warning_N(format, ## __VA_ARGS__)
    #define log_i_warning_11(format, ...) log_i_warning_N(format, ## __VA_ARGS__)

    #define log_k_warning_raw(...) CONCAT(log_k_warning_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_k_warning(...) _(S_ = log_k_warning_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_k_warning_0() _log_k_warning("", __FILE__, __LINE__)
        #define log_k_warning_1(message) _log_k_warning(message, __FILE__, __LINE__)
        #define log_k_warning_N(format, ...) _log_k_warning(sprintfk(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_k_warning_0() _log_k_warning("")
        #define log_k_warning_1(message) _log_k_warning(message)
        #define log_k_warning_N(format, ...) _log_k_warning(sprintfk(format, ## __VA_ARGS__))
    #endif
    #define log_k_warning_2(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_3(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_4(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_5(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_6(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_7(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_8(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_9(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_10(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
    #define log_k_warning_11(format, ...) log_k_warning_N(format, ## __VA_ARGS__)
#else
    #define log_i_warning_raw(...)
    #define log_i_warning(...)
    #define log_k_warning_raw(...)
    #define log_k_warning(...)
#endif

#if LOG_ERROR
    #define log_i_error_raw(...) CONCAT(log_i_error_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_i_error(...) _(S_ = log_i_error_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_i_error_0() _log_i_error("", __FILE__, __LINE__)
        #define log_i_error_1(message) _log_i_error(message, __FILE__, __LINE__)
        #define log_i_error_N(format, ...) _log_i_error(sprintf(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_i_error_0() _log_i_error("")
        #define log_i_error_1(message) _log_i_error(message)
        #define log_i_error_N(format, ...) _log_i_error(sprintf(format, ## __VA_ARGS__))
    #endif
    #define log_i_error_2(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_3(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_4(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_5(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_6(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_7(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_8(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_9(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_10(format, ...) log_i_error_N(format, ## __VA_ARGS__)
    #define log_i_error_11(format, ...) log_i_error_N(format, ## __VA_ARGS__)

    #define log_k_error_raw(...) CONCAT(log_k_error_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_k_error(...) _(S_ = log_k_error_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_k_error_0() _log_k_error("", __FILE__, __LINE__)
        #define log_k_error_1(message) _log_k_error(message, __FILE__, __LINE__)
        #define log_k_error_N(format, ...) _log_k_error(sprintfk(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_k_error_0() _log_k_error("")
        #define log_k_error_1(message) _log_k_error(message)
        #define log_k_error_N(format, ...) _log_k_error(sprintfk(format, ## __VA_ARGS__))
    #endif
    #define log_k_error_2(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_3(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_4(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_5(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_6(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_7(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_8(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_9(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_10(format, ...) log_k_error_N(format, ## __VA_ARGS__)
    #define log_k_error_11(format, ...) log_k_error_N(format, ## __VA_ARGS__)
#else
    #define log_i_error_raw(...)
    #define log_i_error(...)
    #define log_k_error_raw(...)
    #define log_k_error(...)
#endif

#if LOG_FATAL
    #define log_i_fatal_raw(...) CONCAT(log_i_fatal_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_i_fatal(...) _(S_ = log_i_fatal_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_i_fatal_0() _log_i_fatal("", __FILE__, __LINE__)
        #define log_i_fatal_1(message) _log_i_fatal(message, __FILE__, __LINE__)
        #define log_i_fatal_N(format, ...) _log_i_fatal(sprintf(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_i_fatal_0() _log_i_fatal("")
        #define log_i_fatal_1(message) _log_i_fatal(message)
        #define log_i_fatal_N(format, ...) _log_i_fatal(sprintf(format, ## __VA_ARGS__))
    #endif
    #define log_i_fatal_2(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_3(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_4(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_5(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_6(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_7(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_8(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_9(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_10(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)
    #define log_i_fatal_11(format, ...) log_i_fatal_N(format, ## __VA_ARGS__)

    #define log_k_fatal_raw(...) CONCAT(log_k_fatal_, ARGUMENT_COUNT(__VA_ARGS__))(__VA_ARGS__)
    #define log_k_fatal(...) _(S_ = log_k_fatal_raw(__VA_ARGS__))
    #if LOG_FILENAMES
        #define log_k_fatal_0() _log_k_fatal("", __FILE__, __LINE__)
        #define log_k_fatal_1(message) _log_k_fatal(message, __FILE__, __LINE__)
        #define log_k_fatal_N(format, ...) _log_k_fatal(sprintfk(format, ## __VA_ARGS__), __FILE__, __LINE__)
    #else
        #define log_k_fatal_0() _log_k_fatal("")
        #define log_k_fatal_1(message) _log_k_fatal(message)
        #define log_k_fatal_N(format, ...) _log_k_fatal(sprintfk(format, ## __VA_ARGS__))
    #endif
    #define log_k_fatal_2(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_3(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_4(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_5(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_6(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_7(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_8(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_9(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_10(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
    #define log_k_fatal_11(format, ...) log_k_fatal_N(format, ## __VA_ARGS__)
#else
    #define log_i_fatal_raw(...)
    #define log_i_fatal(...)
    #define log_k_fatal_raw(...)
    #define log_k_fatal(...)
#endif

#define log_ik_trace(...) log_i_trace(log_k_trace_raw(__VA_ARGS__))
#define log_ik_debug(...) log_i_debug(log_k_debug_raw(__VA_ARGS__))
#define log_ik_info(...) log_i_info(log_k_info_raw(__VA_ARGS__))
#define log_ik_warning(...) log_i_warning(log_k_warning_raw(__VA_ARGS__))
#define log_ik_error(...) log_i_error(log_k_error_raw(__VA_ARGS__))
#define log_ik_fatal(...) log_i_fatal(log_k_fatal_raw(__VA_ARGS__))

#endif // #ifndef CsoundCMake_definitions_h
