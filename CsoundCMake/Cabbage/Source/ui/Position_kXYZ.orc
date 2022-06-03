iPositionPortTime = 50 / giKR

kPositionMaxAmpWhenClose = portk(CC_VALUE_k(positionMaxAmpWhenClose), iPositionPortTime, CC_VALUE_i(positionMaxAmpWhenClose))
kPositionReferenceDistance = portk(CC_VALUE_k(positionReferenceDistance), iPositionPortTime, CC_VALUE_i(positionReferenceDistance))
kPositionRolloffFactor = portk(CC_VALUE_k(positionRolloffFactor), iPositionPortTime, CC_VALUE_i(positionRolloffFactor))
kX, kY, kZ dEd_position CC_VALUE_k(positionOpcodeComboBoxIndex)

; prints("%d: CC_VALUE_i(positionZOffset) = %f\n", p1, CC_VALUE_i(positionZOffset))

// The portk opcode forces the 3rd arg to 0 if it's negative. Work around this by flipping the signs if needed.
iXOffsetSign = 1
iYOffsetSign = 1
iZOffsetSign = 1
if (CC_VALUE_i(positionXOffset) < 0) then
    iXOffsetSign = -1
endif
if (CC_VALUE_i(positionYOffset) < 0) then
    iOffsetSign = -1
endif
if (CC_VALUE_i(positionZOffset) < 0) then
    iZOffsetSign = -1
endif

kPositionXScale = portk(CC_VALUE_k(positionXScale), iPositionPortTime, CC_VALUE_i(positionXScale))
kPositionYScale = portk(CC_VALUE_k(positionYScale), iPositionPortTime, CC_VALUE_i(positionYScale))
kPositionZScale = portk(CC_VALUE_k(positionZScale), iPositionPortTime, CC_VALUE_i(positionZScale))
kPositionXOffset = portk(CC_VALUE_k(positionXOffset) * iXOffsetSign, iPositionPortTime, CC_VALUE_i(positionXOffset) * iXOffsetSign)
kPositionYOffset = portk(CC_VALUE_k(positionYOffset) * iYOffsetSign, iPositionPortTime, CC_VALUE_i(positionYOffset) * iYOffsetSign)
kPositionZOffset = portk(CC_VALUE_k(positionZOffset) * iZOffsetSign, iPositionPortTime, CC_VALUE_i(positionZOffset) * iZOffsetSign)
kPositionXOffset *= iXOffsetSign
kPositionYOffset *= iYOffsetSign
kPositionZOffset *= iZOffsetSign

; if (lastcycle() == 1) then
    ; printsk("%d: CC_VALUE_k(positionZOffset) = %f\n", p1, CC_VALUE_k(positionZOffset))
    ; printsk("%d: kPositionZOffset = %f\n", p1, kPositionZOffset)
; endif

kX *= kPositionXScale
kY *= kPositionYScale
kZ *= kPositionZScale

kX += kPositionXOffset
kY += kPositionYOffset
kZ += kPositionZOffset

; if (changed2(kX) == true || changed2(kY) == true || changed2(kZ) == true) then
;     log_k_debug("position = [%f, %f, %f]", kX, kY, kZ)
; endif
