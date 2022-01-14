#include "definitions.h"

#ifndef TriangleUdo1_h_orc__include_guard
#define TriangleUdo1_h_orc__include_guard


opcode dEd_TriangleUdo1, a, 0
    xtratim(5)
    iAmp = 0.4
    iCps = cpsmidinn:i(60)
    
    aOut = vco2(iAmp, iCps, VCO2_WAVEFORM_TRIANGLE_NO_RAMP)
    xout aOut
endop


#endif
