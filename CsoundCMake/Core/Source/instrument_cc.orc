
${CSOUND_DEFINE} CC_INFO_CHANNEL #0#
${CSOUND_DEFINE} CC_INFO_TYPE #1#
${CSOUND_DEFINE} CC_INFO_VALUE #2#
${CSOUND_DEFINE} CC_INFO_SYNC_TYPE #3#

${CSOUND_DEFINE} CC_NO_SYNC #0#
${CSOUND_DEFINE} CC_SYNC_TO_CHANNEL #1#


#ifndef CC_ORC_INCLUDED
    #define CC_ORC_INCLUDED
#else
    #undef ccIndex
    #undef giCcCount
    #undef gSCcValueDefaults
    #undef giCcValueDefaults
    #undef gSCcValues
    #undef giCcValues
    #undef gkCcValues
    #undef gSCcInfo

    #undef CC_INDEX
    #undef CC_VALUE_default
    #undef CC_VALUE_i
    #undef CC_VALUE_k
    #undef CREATE_CC_INDEX
#endif


#define ccIndex CONCAT(ccIndex_, INSTRUMENT_NAME)
#define giCcCount CONCAT(giCcCount_, INSTRUMENT_NAME)
#define gSCcValueDefaults CONCAT(gSCcValueDefaults_, INSTRUMENT_NAME)
#define giCcValueDefaults CONCAT(giCcValueDefaults_, INSTRUMENT_NAME)
#define gSCcValues CONCAT(gSCcValues_, INSTRUMENT_NAME)
#define giCcValues CONCAT(giCcValues_, INSTRUMENT_NAME)
#define gkCcValues CONCAT(gkCcValues_, INSTRUMENT_NAME)
#define gkCcSyncTypes CONCAT(gkCcSyncTypes_, INSTRUMENT_NAME)
#define gSCcInfo CONCAT(gSCcInfo_, INSTRUMENT_NAME)

#define CC_INDEX(channel) CONCAT(CONCAT(giCc_, INSTRUMENT_NAME), CONCAT(_, channel))
#define CREATE_CC_INDEX(channel) CC_INDEX(channel) init ccIndex(STRINGIZE(channel))

#define CC_VALUE_default_S(channel) gSCcValueDefaults[CC_INDEX(channel)]
#define CC_VALUE_default_i(channel) giCcValueDefaults[CC_INDEX(channel)]
#define CC_VALUE_i(channel) giCcValues[iOrcInstanceIndex][CC_INDEX(channel)]
#define CC_VALUE_k(channel) gkCcValues[iOrcInstanceIndex][CC_INDEX(channel)]

${CSOUND_DEFINE} CC_CHANNEL_NAME(channel) #gSCcInfo[CC_INDEX($channel)][$CC_INFO_CHANNEL]#

#define InitializeCcValuesInstrument CONCAT(INSTRUMENT_NAME, _InitializeCcValues)
#define CreateCcIndexesInstrument CONCAT(INSTRUMENT_NAME, _CreateCcIndexes)

${CSOUND_IFDEF} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count)
    log_i_trace("Checking CC info array for reshape ...")
    // Reshape the gSCcInfo array if it hasn't been reshaped already. This check is required for reloadable instruments
    // because global arrays retain their shape across reloads.
    log_i_debug("gSCcInfo length = %d", lenarray(gSCcInfo))
    log_i_debug("gSCcInfo count = %d", CONCAT($, CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count)))
    if (lenarray(gSCcInfo) != CONCAT($, CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count))) \
        igoto CONCAT(skipCcInfoReshapeArray_, INSTRUMENT_NAME)
    giCcCount = (lenarray(gSCcInfo) / 4) - 1
    reshapearray(gSCcInfo, giCcCount + 1, 4)
    log_i_debug("gSCcInfo reshaped to length %d", giCcCount)
    CONCAT(skipCcInfoReshapeArray_, INSTRUMENT_NAME): // reshape array skipped
    log_i_trace("Checking CC info array for reshape - done")
${CSOUND_ELSE}
    // If gSCcInfo_INSTRUMENT_NAME_Count is not defined then the instrument is not reloadable and the array size check
    // is not possible.
    giCcCount = (lenarray(gSCcInfo) / 4) - 1
    reshapearray(gSCcInfo, giCcCount + 1, 4)
${CSOUND_ENDIF}

opcode ccIndex, i, S
    SChannel xin
    kgoto end
    iI = 0
    while (iI < giCcCount) do
        if (strcmp(gSCcInfo[iI][$CC_INFO_CHANNEL], SChannel) == 0) igoto end
        iI += 1
    od
    iI = -1
end:
    // Uncomment the following line to dump the CC index numbers and names.
    ; printf("%d = %s\n", 1, iI, SChannel)
    xout iI
endop

gSCcValueDefaults[] init giCcCount
giCcValueDefaults[] init giCcCount
gSCcValues[][] init ORC_INSTANCE_COUNT, giCcCount
giCcValues[][] init ORC_INSTANCE_COUNT, giCcCount
gkCcValues[][] init ORC_INSTANCE_COUNT, giCcCount

gkCcSyncTypes[][] init ORC_INSTANCE_COUNT, giCcCount

// Set CC default values.
instr InitializeCcValuesInstrument
    log_ik_debug("Initializing CC values ...")

    iI = 0
    while (iI < giCcCount) do
        SType = gSCcInfo[iI][$CC_INFO_TYPE]
        SValue = gSCcInfo[iI][$CC_INFO_VALUE]

        iJ = 0
        while (iJ < ORC_INSTANCE_COUNT) do
            iValue = -1
            if (strcmp(SType, "string") == 0) then
                gSCcValueDefaults[iI] = SValue
                gSCcValues[iJ][iI] = SValue
            else
                if (strcmp(SType, "bool") == 0) then
                    if (strcmp(SValue, "false") == 0) then
                        iValue = 0
                    else
                        iValue = 1
                    endif
                elseif (strcmp(SType, "number") == 0 && strcmp(SValue, "") != 0) then
                    iValue = strtod(SValue)
                endif
                giCcValueDefaults[iI] = iValue
                giCcValues[iJ][iI] = iValue
            endif
            iJ += 1
        od
        iI += 1
    od

    igoto end

    kI = 0
    while (kI < giCcCount) do
        SType = gSCcInfo[kI][$CC_INFO_TYPE]
        SValue = gSCcInfo[kI][$CC_INFO_VALUE]
        SSyncType = gSCcInfo[kI][$CC_INFO_SYNC_TYPE]

        kJ = 0
        while (kJ < ORC_INSTANCE_COUNT) do
            kValue = -1
            if (strcmpk(SType, "bool") == 0) then
                if (strcmpk(SValue, "false") == 0) then
                    kValue = 0
                else
                    kValue = 1
                endif
            elseif (strcmpk(SType, "number") == 0 && strcmpk(SValue, "") != 0) then
                kValue = strtodk(SValue)
            endif
            gkCcValues[kJ][kI] = kValue

            gkCcSyncTypes[kJ][kI] = $CC_NO_SYNC
            if (strcmpk(SSyncType, "synced") == 0) then
                gkCcSyncTypes[kJ][kI] = $CC_SYNC_TO_CHANNEL
            endif
            kJ += 1
        od
        kI += 1
    od
    turnoff
end:
endin

event_i("i", STRINGIZE(InitializeCcValuesInstrument), 0, -1)
