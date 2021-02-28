
# DAW service notes

## Modes

- ***Mode 1:* Playback**
    - No special handling.
    - CSD should operate as a normal plugin.

- ***Mode 2:* Track and plugin chain discovery**
    - Track indexes:
        - Each track's 1st plugin sends it's id (OSC port) to DAW service and DAW service sends back the track index to use for mode 4.
        - For instrument tracks the 1st plugin must be an synth plugin.
        - For effect tracks the 1st plugin must be a track info plugin.
    - Plugin ids:
        - Track 1 - 1st plugin sends a 0.000001 value to 2nd plugin for sample [1].
        - Track 1 - 2nd plugin sends a 0.000002 value to 3rd plugin for sample [1].
        - Etc, etc ...
        - Track 2 - 1st plugin sends a 0.000001 value to 2nd plugin for sample [2].
        - Track 2 - 2nd plugin sends a 0.000002 value to 3rd plugin for sample [2].
        - Etc, etc ...
        - Plugins send their instrument id and track plugin index/order to DAW service.

- ***Mode 3:* Track send/volume level automation discovery**
    - Track with index 1 sends a 0.001 value for sample [1].
    - Track with index 2 sends a 0.001 value for sample [2].
    - Etc, etc ...
    - DAW service reads the resulting wave file output and uses it to write the score events needed to replicate the track and aux send values.

- ***Mode 4:* Csound score generation**
    - Plugins send all note on/off and control channel events with instrument id to DAW service.
    - DAW service writes the score from the given plugin events.
