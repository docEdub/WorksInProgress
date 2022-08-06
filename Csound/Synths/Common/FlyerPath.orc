// Path geometry generated in Javascript.
#if IS_PLAYBACK
    gi${InstrumentName}_PathAudioPositions[] init _($){${FlyerPath}.audioPositionsString}
#else
    gi${InstrumentName}_PathAudioPositions[] init ${FlyerPath.audioPositionsString} // [flattened array of xyz coords]
#endif
