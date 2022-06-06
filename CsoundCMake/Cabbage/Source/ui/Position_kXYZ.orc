iPositionLagTime = 2

kPositionMaxAmpWhenClose = lag:k(CC_VALUE_k(positionMaxAmpWhenClose), iPositionLagTime)
kPositionReferenceDistance = lag:k(CC_VALUE_k(positionReferenceDistance), iPositionLagTime)
kPositionRolloffFactor = lag:k(CC_VALUE_k(positionRolloffFactor), iPositionLagTime)

kX, kY, kZ dEd_position CC_VALUE_k(positionOpcodeComboBoxIndex)

kX *= lag:k(CC_VALUE_k(positionXScale), iPositionLagTime)
kY *= lag:k(CC_VALUE_k(positionYScale), iPositionLagTime)
kZ *= lag:k(CC_VALUE_k(positionZScale), iPositionLagTime)

kX += lag:k(CC_VALUE_k(positionXOffset), iPositionLagTime)
kY += lag:k(CC_VALUE_k(positionYOffset), iPositionLagTime)
kZ += lag:k(CC_VALUE_k(positionZOffset), iPositionLagTime)
