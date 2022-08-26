
${CSOUND_INCLUDE} "adsr_linsegr.udo.orc"

#ifndef CSD_CC_INFO
    #define CSD_CC_INFO
#endif

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    POSITION_CC_INFO \
    CSD_CC_INFO
_(\)
    "",                                         "",         "",                 "") // dummy line

#undef CSD_CC_INFO

#ifdef CC_INFO_COUNT
    #undef CC_INFO_COUNT
#endif
#ifdef CSD_CC_INFO_COUNT
    #define CC_INFO_COUNT 52 + CSD_CC_INFO_COUNT
#else
    #define CC_INFO_COUNT 52
#endif

${CSOUND_IFDEF} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count)
    ${CSOUND_UNDEF} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count)
${CSOUND_ENDIF}
${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #CC_INFO_COUNT#

#include "instrument_cc.orc"

#undef CSD_CC_INFO_COUNT

#ifndef CSD_CC_INDEXES
    #define CSD_CC_INDEXES
#endif

instr CreateCcIndexesInstrument
    #include "Position_ccIndexes.orc"
    #ifdef HAS_CSD_CC_INDEXES_ORC
        #include "${InstrumentName}_ccIndexes.orc"
    #endif
    turnoff
endin

#undef CSD_CC_INDEXES

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
${CSOUND_INCLUDE} "math.orc"
${CSOUND_INCLUDE} "PositionUdos.orc"
${CSOUND_INCLUDE} "time.orc"
