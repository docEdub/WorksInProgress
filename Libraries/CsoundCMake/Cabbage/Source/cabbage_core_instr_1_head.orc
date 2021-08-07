 #include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: cabbage_core_instr_1_head.orc
//----------------------------------------------------------------------------------------------------------------------

    ${CSOUND_INCLUDE} "core_instr_1_head.orc"

    gk_playing chnget "IS_PLAYING"

    if (changed(gk_playing) == true) then
        log_k_info("gk_playing changed to %d", gk_playing)
        if (gk_playing == true) then
            gk_dawPlayStartTime = time_k()
            log_k_debug("gk_dawPlayStartTime = %f", gk_dawPlayStartTime)
        endif
    endif

    k_instanceNameChanged init false
    k_isCsdInfoLogged init false

    gS_instanceName chngetks "instanceName"

    if (strcmpk(gS_instanceName, "") == 0) then
        gS_instanceName = $INSTANCE_NAME
    elseif (changed(gS_instanceName) == true) then
        k_instanceNameChanged = true
    endif
    #if LOG_INFO
        if (ksmps < gk_i && k_instanceNameChanged == true) then
            k_instanceNameChanged = false
            log_k_info("Instance name changed to '%s'", gS_instanceName)
            if (k_isCsdInfoLogged == false) then
                k_isCsdInfoLogged = true
                if (gk_isPlugin == true) then
                    S_isPlugin = string_k("true")
                else
                    S_isPlugin = string_k("false")
                endif
                /* --->                         # 1  2  3  4  5  6  7  8  9  10 11 */
                S_info = sprintfk("CSD info ...\n %s %s %s %s %s %s %s %s %s %s %s",
                    /*  1 */ "--------------------------------------------------------------------------------------\n",
                    /*  2 */ sprintfk(" csd    = %s\n", gS_csdFileName),
                    /*  3 */ sprintfk(" plugin = %s\n", S_isPlugin),
                    /*  4 */ sprintfk(" os     = %s\n", gS_os)   ,
                    /*  5 */ sprintfk(" host   = %s\n", gS_host),
                    /*  6 */ sprintfk(" sr     = %d\n", sr),
                    /*  7 */ sprintfk(" kr     = %d\n", kr),
                    /*  8 */ sprintfk(" ksmps  = %d\n", ksmps),
                    /*  9 */ sprintfk(" nchnls = %d\n", nchnls),
                    /* 10 */ sprintfk(" 0dbfs  = %f\n", 0dbfs),
                    /* 11 */ "--------------------------------------------------------------------------------------")
                log_k_info(S_info)
            endif
        endif
    #endif

    if (gk_i < (2 * ksmps)) then
        gk_isPlugin chnget "IS_A_PLUGIN"

        #define KNOWN_HOSTS \
            "AbletonLive", \
            "AdobeAudition", \
            "Ardour", \
            "Bitwig", \
            "Cubase", \
            "FLStudio", \
            "GarageBand", \
            "Logic", \
            "MainStage", \
            "Renoise", \
            "Reaper", \
            "Samplitude", \
            "Sonar", \
            "StudioOne", \
            "Tracktion", \
            "Wavelab"
        S_hosts[] = fillarray(KNOWN_HOSTS)
        k_hostKnown = false
        k_host_i = 0
        i_host_count = lenarray(S_hosts)
        while (k_hostKnown == false && k_host_i < i_host_count) do
            k_hostKnown chnget S_hosts[k_host_i]
            if (k_hostKnown == true) then
                gS_host = S_hosts[k_host_i]
            endif
            k_host_i += 1
        od

        S_systems[] = fillarray("LINUX","Linux",  "MACOS","MacOS",  "WINDOWS","Windows")
        i_system_count = lenarray(S_systems) / 2
        reshapearray(S_systems, i_system_count, 2)
        k_systemKnown = false
        k_system_i = 0
        while (k_systemKnown == false && k_system_i < i_system_count) do
            k_systemKnown chnget S_systems[k_system_i][0]
            if (k_systemKnown == true) then
                gS_os = S_systems[k_system_i][1]
            endif
            k_system_i += 1
        od
    endif

//----------------------------------------------------------------------------------------------------------------------
