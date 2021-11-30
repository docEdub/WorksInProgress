iPositionMaxAmpWhenClose = CC_VALUE_i(positionMaxAmpWhenClose)
iPositionReferenceDistance = CC_VALUE_i(positionReferenceDistance)
iPositionRolloffFactor = CC_VALUE_i(positionRolloffFactor)
iX, iY, iZ dEd_position CC_VALUE_i(positionOpcodeComboBoxIndex)

iX += CC_VALUE_i(positionXOffset)
iY += CC_VALUE_i(positionYOffset)
iZ += CC_VALUE_i(positionZOffset)

iX *= CC_VALUE_i(positionXScale)
iY *= CC_VALUE_i(positionYScale)
iZ *= CC_VALUE_i(positionZScale)

kX init iX
kY init iY
kZ init iZ
kPositionMaxAmpWhenClose init iPositionMaxAmpWhenClose
kPositionReferenceDistance init iPositionReferenceDistance
kPositionRolloffFactor init iPositionRolloffFactor

; log_i_debug("position = [%f, %f, %f]", iX, iY, iZ)
