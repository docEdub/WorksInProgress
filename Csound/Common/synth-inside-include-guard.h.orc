
${CSOUND_INCLUDE} "adsr_linsegr.udo.orc"

CONCAT(gSCcInfo_, INSTRUMENT_NAME)[] = fillarray( _(\)
_(\)
    POSITION_CC_INFO
_(\)
    "",                                         "",         "",                 "") // dummy line

${CSOUND_DEFINE} CONCAT(CONCAT(gSCcInfo_, INSTRUMENT_NAME), _Count) #52#

#include "instrument_cc.orc"

instr CreateCcIndexesInstrument
    #include "Position_ccIndexes.orc"
    turnoff
endin

event_i("i", STRINGIZE(CreateCcIndexesInstrument), 0, -1)

//----------------------------------------------------------------------------------------------------------------------

${CSOUND_INCLUDE} "af_spatial_opcodes.orc"
${CSOUND_INCLUDE} "math.orc"
${CSOUND_INCLUDE} "PositionUdos.orc"
${CSOUND_INCLUDE} "time.orc"
