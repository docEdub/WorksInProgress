// Path geometry generated in Javascript.
#if IS_PLAYBACK
    gi${InstrumentName}_PathAudioPoints[] init _($){${FlyerPath}.audioPointsString}
    gi${InstrumentName}_PathSpeedMultipler init _($){${FlyerPath}.speedMultipler}
#else
    // Flattened array of xyz coords.
    gi${InstrumentName}_PathAudioPoints[] init ${FlyerPath.audioPointsString}
    gi${InstrumentName}_PathSpeedMultipler init ${FlyerPath.speedMultiplier}
#endif

gi${InstrumentName}_PathPointCount init lenarray(gi${InstrumentName}_PathAudioPoints) / 3
gi${InstrumentName}_PathPointLastIndex init gi${InstrumentName}_PathPointCount - 1
