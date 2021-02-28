#include "definitions.h"

//----------------------------------------------------------------------------------------------------------------------
// File: TestMasterHead.orc
//----------------------------------------------------------------------------------------------------------------------

#ifdef INSTRUMENT_ID
    #define INSTRUMENT_ID_DEFINED
#else
    #define INSTRUMENT_ID TestMasterHead
#endif


instr INSTRUMENT_ID
    #if LOGGING
        #ifdef INSTRUMENT_ID_DEFINED
            S_instrument = sprintf("%.3f", p1)
        #else
            S_instrument = sprintf("%s.%03d", nstrstr(p1), 1000 * frac(p1))
        #endif
    #endif
    log_i_info("%s ...", S_instrument)

    log_i_info("%s - done", S_instrument)
endin

//----------------------------------------------------------------------------------------------------------------------
