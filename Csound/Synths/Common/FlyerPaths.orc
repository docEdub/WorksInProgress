// Path geometry generated in Javascript.
#if IS_PLAYBACK
    gi${InstrumentName}_Flyer1PathAudioPoints[] init _($){SHARED.Flyer1Path.audioPointsString}
    gi${InstrumentName}_Flyer1PathSpeedMultipler init _($){SHARED.Flyer1Path.speedMultiplier}
    gi${InstrumentName}_Flyer2PathAudioPoints[] init _($){SHARED.Flyer2Path.audioPointsString}
    gi${InstrumentName}_Flyer2PathSpeedMultipler init _($){SHARED.Flyer2Path.speedMultiplier}
    gi${InstrumentName}_Flyer3PathAudioPoints[] init _($){SHARED.Flyer3Path.audioPointsString}
    gi${InstrumentName}_Flyer3PathSpeedMultipler init _($){SHARED.Flyer3Path.speedMultiplier}
#else
    // Flattened array of xyz coords.
    gi${InstrumentName}_Flyer1PathAudioPoints[] init ${Flyer1Path.audioPointsString}
    gi${InstrumentName}_Flyer1PathSpeedMultipler init ${Flyer1Path.speedMultiplier}
    // Flattened array of xyz coords.
    gi${InstrumentName}_Flyer2PathAudioPoints[] init ${Flyer2Path.audioPointsString}
    gi${InstrumentName}_Flyer2PathSpeedMultipler init ${Flyer2Path.speedMultiplier}
    // Flattened array of xyz coords.
    gi${InstrumentName}_Flyer3PathAudioPoints[] init ${Flyer3Path.audioPointsString}
    gi${InstrumentName}_Flyer3PathSpeedMultipler init ${Flyer3Path.speedMultiplier}
#endif

gi${InstrumentName}_PathCoordinateCount init lenarray(gi${InstrumentName}_Flyer1PathAudioPoints)
gi${InstrumentName}_PathPointCount init gi${InstrumentName}_PathCoordinateCount / 3
gi${InstrumentName}_PathPointLastIndex init gi${InstrumentName}_PathPointCount - 1

gi${InstrumentName}_PathAudioPoints[][] init 3, gi${InstrumentName}_PathCoordinateCount
gi${InstrumentName}_PathSpeedMultipler[] init 3

ii = 0
while (ii < gi${InstrumentName}_PathCoordinateCount) do
    gi${InstrumentName}_PathAudioPoints[0][ii] = gi${InstrumentName}_Flyer1PathAudioPoints[ii]
    gi${InstrumentName}_PathAudioPoints[1][ii] = gi${InstrumentName}_Flyer2PathAudioPoints[ii]
    gi${InstrumentName}_PathAudioPoints[2][ii] = gi${InstrumentName}_Flyer3PathAudioPoints[ii]
    ii += 1
od

gi${InstrumentName}_PathSpeedMultipler[0] = gi${InstrumentName}_Flyer1PathSpeedMultipler
gi${InstrumentName}_PathSpeedMultipler[1] = gi${InstrumentName}_Flyer2PathSpeedMultipler
gi${InstrumentName}_PathSpeedMultipler[2] = gi${InstrumentName}_Flyer3PathSpeedMultipler
