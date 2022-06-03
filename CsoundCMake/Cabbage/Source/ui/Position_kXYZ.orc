iPositionPortTime = 50 / giKR

kPositionMaxAmpWhenClose = portk(CC_VALUE_k(positionMaxAmpWhenClose), iPositionPortTime)
kPositionReferenceDistance = portk(CC_VALUE_k(positionReferenceDistance), iPositionPortTime)
kPositionRolloffFactor = portk(CC_VALUE_k(positionRolloffFactor), iPositionPortTime)
kX, kY, kZ dEd_position CC_VALUE_k(positionOpcodeComboBoxIndex)

kPositionXScale = portk(CC_VALUE_k(positionXScale), iPositionPortTime, CC_VALUE_i(positionXScale))
kPositionYScale = portk(CC_VALUE_k(positionYScale), iPositionPortTime, CC_VALUE_i(positionYScale))
kPositionZScale = portk(CC_VALUE_k(positionZScale), iPositionPortTime, CC_VALUE_i(positionZScale))
kPositionXOffset = portk(CC_VALUE_k(positionXOffset), iPositionPortTime, CC_VALUE_i(positionXOffset))
kPositionYOffset = portk(CC_VALUE_k(positionYOffset), iPositionPortTime, CC_VALUE_i(positionYOffset))
kPositionZOffset = portk(CC_VALUE_k(positionZOffset), iPositionPortTime, CC_VALUE_i(positionZOffset))

kX *= kPositionXScale
kY *= kPositionYScale
kZ *= kPositionZScale

kX += kPositionXOffset
kY += kPositionYOffset
kZ += kPositionZOffset

; if (changed2(kX) == true || changed2(kY) == true || changed2(kZ) == true) then
;     log_k_debug("position = [%f, %f, %f]", kX, kY, kZ)
; endif
