#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: log.orc.h
//
// N.B. #define log_level to 'trace', 'debug', 'info', 'warning', 'error' or 'fatal' before including this file.
//----------------------------------------------------------------------------------------------------------------------

#if LOGGING

#if LOG_FILENAMES
opcode CONCAT(_log_i_, log_level), S, SSi
    S_message, S_file, i_line xin
#else
opcode CONCAT(_log_i_, log_level), S, S
    S_message xin
#endif
    S_fullMessage = sprintf("<%s>  %s", gS_instanceName, gS_csdFileName)
    #if LOG_FILENAMES
        S_filename = filename_from_full_path_i(S_file)
        S_location = sprintf("%s%s", S_filename, log_line_string(i_line))
        S_fullMessage = strcat(S_fullMessage, sprintf(" -> %s", S_location))
    #endif
    S_fullMessage = strcat(S_fullMessage, sprintf("  i.%d  [%s]:  %s", i(gk_i) + 1,
        CONCAT(CONCAT($log_level_, log_level), _abbreviation), S_message))

    #if LOG_TO_CSOUND_OUTPUT
        printf_i("%s  %s\n", 1, time_string_i(), S_fullMessage)
    #endif

    #if LOG_TO_DAW_SERVICE
        #ifndef DISABLE_LOGGING_TO_DAW_SERVICE
            if (0 < gk_i) then
                scoreline_i(sprintf("i \"LogToDAW\" 0 1 \"%s\"", S_fullMessage))
            endif
        #endif
    #endif

    xout S_message
endop

#if LOG_FILENAMES
opcode CONCAT(_log_k_, log_level), S, SSi
    S_message, S_file, i_line xin
#else
opcode CONCAT(_log_k_, log_level), S, S
    S_message xin
#endif
    k_i init 0
    k_i += 1
    S_fullMessage = sprintfk("<%s>  %s", gS_instanceName, gS_csdFileName)
    #if LOG_FILENAMES
        S_filename = filename_from_full_path_i(S_file)
        S_location = sprintfk("%s%s", S_filename, log_line_string(i_line))
        S_fullMessage = strcatk(S_fullMessage, sprintfk(" -> %s", S_location))
    #endif
    S_fullMessage = strcatk(S_fullMessage, sprintfk("  k.%d  [%s]:  %s", gk_i,
        CONCAT(CONCAT($log_level_, log_level), _abbreviation), S_message))

    #if LOG_TO_CSOUND_OUTPUT
        printf("%s  %s\n", k_i, time_string_k(), S_fullMessage)
    #endif

    #if LOG_TO_DAW_SERVICE
        #ifndef DISABLE_LOGGING_TO_DAW_SERVICE
            if (k(0) < gk_i) then
                scoreline(sprintfk("i \"LogToDAW\" 0 1 \"%s\"", string_escape_k(S_fullMessage)), k_i)
            endif
        #endif
    #endif
    
    xout S_message
endop

#endif // #if LOGGING

//----------------------------------------------------------------------------------------------------------------------
