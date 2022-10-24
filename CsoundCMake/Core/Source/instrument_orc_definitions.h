
#ifdef INSTRUMENT_ID
    #define INSTRUMENT_ID_DEFINED
#else
    #define INSTRUMENT_ID INSTRUMENT_NAME
#endif

#ifndef INSTRUMENT_TRACK_INDEX
    #define INSTRUMENT_TRACK_INDEX 0
#endif

// TODO: This might be unused, now. If unused, remove it from this file, DawService.csd and TrackInfo_*.orc.
#ifndef INSTRUMENT_PLUGIN_INDEX
    #define INSTRUMENT_PLUGIN_INDEX 0
#endif

#ifndef ORC_INSTANCE_COUNT
    #define ORC_INSTANCE_COUNT 1
#endif

#ifndef ORC_INSTANCE_INDEX
    #define ORC_INSTANCE_INDEX 0
#endif

#ifndef MIX_ID
    #define MIX_ID 0/0
#endif

_(#)ifndef MIX_CHANNEL_COUNT
    _(#)ifdef INTERNAL_CHANNEL_COUNT
        _(#)define MIX_CHANNEL_COUNT _(#) $INTERNAL_CHANNEL_COUNT _(#)
    _(#)else
        _(#)define MIX_CHANNEL_COUNT _(#) 6 _(#)
    _(#)endif
_(#)endif

ii = 0
while (ii < $MIX_CHANNEL_COUNT) do
    chn_a(sprintf("%s/%d", STRINGIZE(MIX_ID), ii), 2)
    ii += 1
od
