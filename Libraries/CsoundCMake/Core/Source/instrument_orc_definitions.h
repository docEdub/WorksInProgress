
#ifdef INSTRUMENT_ID
    #define INSTRUMENT_ID_DEFINED
#else
    #define INSTRUMENT_ID INSTRUMENT_NAME
#endif

#ifndef INSTRUMENT_TRACK_INDEX
    #define INSTRUMENT_TRACK_INDEX 0
#endif

// TODO: This might be unused, now. If unused, remove it from this file, daw-service.csd and TrackInfo-*.orc.
#ifndef INSTRUMENT_PLUGIN_INDEX
    #define INSTRUMENT_PLUGIN_INDEX 0
#endif

#ifndef ORC_INSTANCE_COUNT
    #define ORC_INSTANCE_COUNT 1
#endif

#ifndef ORC_INSTANCE_INDEX
    #define ORC_INSTANCE_INDEX 0
#endif
