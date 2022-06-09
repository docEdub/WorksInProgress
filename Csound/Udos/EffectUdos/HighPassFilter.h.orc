#include "definitions.h"

#ifndef HighPassFilter_h_orc__include_guard
#define HighPassFilter_h_orc__include_guard


opcode dEd_HighPassFilter, a, ia
    iCutoffFrequencyHz, a1 xin
    xout atone(a1, k(iCutoffFrequencyHz))
endop


#endif
