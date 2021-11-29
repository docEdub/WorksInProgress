iPositionPortTime = 50 / kr

kPositionMaxAmpWhenClose = portk(CC_VALUE_k(positionMaxAmpWhenClose), iPositionPortTime)
kPositionReferenceDistance = portk(CC_VALUE_k(positionReferenceDistance), iPositionPortTime)
kPositionRolloffFactor = portk(CC_VALUE_k(positionRolloffFactor), iPositionPortTime)
kX, kY, kZ dEd_position

kX += portk(CC_VALUE_k(positionXOffset), iPositionPortTime)
kY += portk(CC_VALUE_k(positionYOffset), iPositionPortTime)
kZ += portk(CC_VALUE_k(positionZOffset), iPositionPortTime)

kX *= portk(CC_VALUE_k(positionXScale), iPositionPortTime)
kY *= portk(CC_VALUE_k(positionYScale), iPositionPortTime)
kZ *= portk(CC_VALUE_k(positionZScale), iPositionPortTime)

; if (changed2(kX) == true || changed2(kY) == true || changed2(kZ) == true) then
;     log_k_debug("position = [%f, %f, %f]", kX, kY, kZ)
; endif
