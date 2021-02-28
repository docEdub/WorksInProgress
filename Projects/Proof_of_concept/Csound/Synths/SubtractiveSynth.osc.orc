
#ifndef SUBTRACTIVESYNTH_OSC_ORC
#define SUBTRACTIVESYNTH_OSC_ORC
    #define aOscX(variable) CONCAT(CONCAT(aOsc, OSC_INDEX), variable)
    #define iOscX(variable) CONCAT(CONCAT(iOsc, OSC_INDEX), variable)
    #define kOscX(variable) CONCAT(CONCAT(kOsc, OSC_INDEX), variable)
    #define oscX(variable) CONCAT(CONCAT(osc, OSC_INDEX), variable)
#endif

if (CC_VALUE_i(oscX(Enabled)) == true) then
    iOscX(Waveform) = CC_VALUE_i(oscX(Waveform))

    kOscX(Volume) = CC_VALUE_default(oscX(Volume))
    if (CC_VALUE_i(oscX(VolumeEnabled)) == true) then
        kOscX(Volume) = CC_VALUE_k(oscX(Volume))

        if (CC_VALUE_i(oscX(VolumeAdsrEnabled)) == true) then
            kOscX(Volume) *= adsr_linsegr(
                CC_VALUE_i(oscX(VolumeAttack)),
                CC_VALUE_i(oscX(VolumeDecay)),
                CC_VALUE_i(oscX(VolumeSustain)),
                CC_VALUE_i(oscX(VolumeRelease)))
        endif

        if (CC_VALUE_i(oscX(VolumeLfoEnabled)) == true) then
            kOscX(Volume) *= lfo(
                CC_VALUE_k(oscX(VolumeLfoAmplitude)),
                CC_VALUE_k(oscX(VolumeLfoFrequency)),
                CC_VALUE_i(oscX(VolumeLfoShape)) - 1)
        endif
    endif
    kOscX(Volume) *= 0.5 * iVelocity

    if (iOscX(Waveform) == $Waveform_Noise) then
        aOut += rand(kOscX(Volume))
    else
        kOscX(PitchOffset) = 0
        if (CC_VALUE_i(oscX(PitchEnabled)) == true) then
            kOscX(PitchOffset) = CC_VALUE_k(oscX(Pitch))
            if (CC_VALUE_i(oscX(PitchAdsrEnabled)) == true) then
                kOscX(PitchOffset) *= adsr_linsegr(
                    CC_VALUE_i(oscX(PitchAttack)),
                    CC_VALUE_i(oscX(PitchDecay)),
                    CC_VALUE_i(oscX(PitchSustain)),
                    CC_VALUE_i(oscX(PitchRelease)))
            endif

            if (CC_VALUE_i(oscX(PitchLfoEnabled)) == true) then
                kOscX(PitchOffset) *= lfo(
                    CC_VALUE_k(oscX(PitchLfoAmplitude)),
                    CC_VALUE_k(oscX(PitchLfoFrequency)),
                    CC_VALUE_i(oscX(PitchLfoShape)) - 1)
            endif
        endif
        kOscX(Cps) = cpsmidinn((k(iPitch) + kOscX(PitchOffset))) * kDopplerShift

        iOscX(VcoMode) init 0
        if (iOscX(Waveform) == $Waveform_Saw) then
            iOscX(VcoMode) = 4
        elseif (iOscX(Waveform) == $Waveform_Square) then
            iOscX(VcoMode) = 2
        elseif (iOscX(Waveform) == $Waveform_Pulse) then
            iOscX(VcoMode) = 6
        endif

        kOscX(PulseWidth) init CC_VALUE_default(oscX(PulseWidth))
        if (CC_VALUE_i(oscX(PulseWidthEnabled)) == true) then
            kOscX(PulseWidth) = CC_VALUE_k(oscX(PulseWidth))
            if (CC_VALUE_i(oscX(PulseWidthAdsrEnabled)) == true) then
                kOscX(PulseWidth) -= 0.5
                kOscX(PulseWidth) *= adsr_linsegr(
                    CC_VALUE_i(oscX(PulseWidthAttack)),
                    CC_VALUE_i(oscX(PulseWidthDecay)),
                    CC_VALUE_i(oscX(PulseWidthSustain)),
                    CC_VALUE_i(oscX(PulseWidthRelease)))
                kOscX(PulseWidth) += 0.5
            endif

            if (CC_VALUE_i(oscX(PulseWidthLfoEnabled)) == true) then
                kOscX(PulseWidth -= 0.5)
                kOscX(PulseWidth) *= lfo(
                    CC_VALUE_k(oscX(PulseWidthLfoAmplitude)),
                    CC_VALUE_k(oscX(PulseWidthLfoFrequency)),
                    CC_VALUE_i(oscX(PulseWidthLfoShape)) - 1)
                kOscX(PulseWidth) += 0.5
            endif
        endif

        aOut += vco2(kOscX(Volume), kOscX(Cps), iOscX(VcoMode), kOscX(PulseWidth))

        iOscX(FilterEnabled) = false

        kOscX(FilterCutoffFrequency) init CC_VALUE_default(oscX(FilterCutoffFrequency))
        if (CC_VALUE_i(oscX(FilterCutoffFrequencyEnabled)) == true) then
            kOscX(FilterCutoffFrequency) = CC_VALUE_k(oscX(FilterCutoffFrequency))

            if (CC_VALUE_i(oscX(FilterCutoffFrequencyAdsrEnabled)) == true) then
                iOscX(FilterCutoffFrequencyDefault) = CC_VALUE_default(oscX(FilterCutoffFrequency))
                kOscX(FilterCutoffFrequencyAdsr) = adsr_linsegr(
                    CC_VALUE_i(oscX(FilterCutoffFrequencyAttack)),
                    CC_VALUE_i(oscX(FilterCutoffFrequencyDecay)),
                    CC_VALUE_i(oscX(FilterCutoffFrequencySustain)),
                    CC_VALUE_i(oscX(FilterCutoffFrequencyRelease)))
                kOscX(FilterCutoffFrequency) = iOscX(FilterCutoffFrequencyDefault) -
                    (kOscX(FilterCutoffFrequencyAdsr) *
                        ((iOscX(FilterCutoffFrequencyDefault) - kOscX(FilterCutoffFrequency)) / 2))
            endif

            if (CC_VALUE_i(oscX(FilterCutoffFrequencyLfoEnabled)) == true) then
                kOscX(FilterCutoffFrequencyLfo) = lfo(
                    CC_VALUE_k(oscX(FilterCutoffFrequencyLfoAmplitude)),
                    CC_VALUE_k(oscX(FilterCutoffFrequencyLfoFrequency)),
                    CC_VALUE_i(oscX(FilterCutoffFrequencyLfoShape)) - 1)
                iOscX(FilterCutoffFrequencyDefault) = CC_VALUE_default(oscX(FilterCutoffFrequency))
                kOscX(CutoffFrequencyMidPoint) =
                    (iOscX(FilterCutoffFrequencyDefault) + kOscX(FilterCutoffFrequency)) / 2
                kOscX(HalfCutoffFrequencyDelta) = kOscX(CutoffFrequencyMidPoint) - kOscX(FilterCutoffFrequency)
                kOscX(FilterCutoffFrequency) = kOscX(CutoffFrequencyMidPoint) +
                    (kOscX(HalfCutoffFrequencyDelta) * kOscX(FilterCutoffFrequencyLfo))
            endif

            iOscX(FilterEnabled) = true
        endif

        kOscX(FilterResonance) init CC_VALUE_default(oscX(FilterResonance))
        if (CC_VALUE_i(oscX(FilterResonanceEnabled)) == true) then
            kOscX(FilterResonance) = CC_VALUE_k(oscX(FilterResonance))

            if (CC_VALUE_i(oscX(FilterResonanceAdsrEnabled)) == true) then
                kOscX(FilterResonanceAdsr) = adsr_linsegr(
                    CC_VALUE_i(oscX(FilterResonanceAttack)),
                    CC_VALUE_i(oscX(FilterResonanceDecay)),
                    CC_VALUE_i(oscX(FilterResonanceSustain)),
                    CC_VALUE_i(oscX(FilterResonanceRelease)))
                iOscX(FilterResonanceDefault) = CC_VALUE_default(oscX(FilterResonance))
                kOscX(FilterResonance) = iOscX(FilterResonanceDefault) -
                    (kOscX(FilterResonanceAdsr) * (iOscX(FilterResonanceDefault) - kOscX(FilterResonance)))
            endif

            if (CC_VALUE_i(oscX(FilterResonanceLfoEnabled)) == true) then
                kOscX(FilterResonanceLfo) = lfo(
                    CC_VALUE_k(oscX(FilterResonanceLfoAmplitude)),
                    CC_VALUE_k(oscX(FilterResonanceLfoFrequency)),
                    CC_VALUE_i(oscX(FilterResonanceLfoShape)) - 1)
                iOscX(FilterResonanceDefault) = CC_VALUE_default(oscX(FilterResonance))
                kOscX(ResonanceMidPoint) =
                    (iOscX(FilterResonanceDefault) + kOscX(FilterResonance)) / 2
                kOscX(HalfResonanceDelta) = kOscX(ResonanceMidPoint) - kOscX(FilterResonance)
                kOscX(FilterResonance) = kOscX(ResonanceMidPoint) +
                    (kOscX(HalfResonanceDelta) * kOscX(FilterResonanceLfo))
            endif

            iOscX(FilterEnabled) = true
        endif

        if (iOscX(FilterEnabled) == true) then
            aOut = moogladder(aOut, kOscX(FilterCutoffFrequency), kOscX(FilterResonance))
        endif
    endif
endif
