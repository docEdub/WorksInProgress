
# 2-PrimitiveTriangles

This project is a work in progress.

## Build

I currently only build on macOS. 

### Build Csound content
1. Install Xcode command line tools for clang, and install Node, CMake 3.21.4, Csound 6.17.0, and Cabbage 2.5.12. Make
  sure `clang`, `node` and `cmake` are on the PATH.
    - Newer versions of CMake will probably work.
    - Csound 6.18.0 does not work correctly for this project, yet.
    - Cabbage 2.5.12 can be downloaded from https://github.com/docEdub/cabbage-releases/releases/download/Cabbage-2.5.12/Cabbage-2.5.12.zip
1. In the `2-PrimitiveTrianglest` folder, run commands:
    ```
    node configure
    node make
    ```
1. To change the build options run command:
    ```
    node make edit_cache
    ```
1. To see `make` targets run command:
    ```
    node make help
    ```
1. To build the VST3 plugins run command:
    ```
    node make vst3
    ```

The .csd files and plugins will be generated in `2-PrimitiveTriangles/Csound/build`.

VST3 plugins should work with Reaper since that's what I use.

### Bounce Reaper projects to monolith Csound .csd
- Build the VST3 plugins (see above).
- Open `ReaperProjects/211214_1_PrimitiveTriangles.rpp` in Reaper.
- In Reaper's mixer window, scroll to the far right and click on the `DawService` plugin at the top of the DawService track to show it's UI. You should see buttons labeled "Mode 1", "Mode 2", etc...
- In the DawService plugin's UI, make sure "Mode 1" is selected and start playback to see if everything is built and working correctly.
- If the Reaper project plays successfully, switch to "Mode 2" and play the Reaper project for a few seconds. This will generate the Csound files needed to bounce the track and plugin chains.
- Next, switch to "Mode 3" and play the Reaper project for a few seconds again to generate the Csound files for track
  send/volume levels and automations.
- Next, switch to "Mode 4" and play the entire Reaper project to generate the Csound score.
- When done, switch back to "Mode 1" for normal playback. **Don't skip this step**. It is required to finalize the Csound score generated using "Mode 4".

If everything went smoothly then you should be able to bounce all the generated Csound files into a monolithic .csd with
the following command:
```
node bounce --with-json
```

This will create 4 files in the `Csound/build/bounce` folder:
1. `DawPlayback.csd` is the raw monolithic .csd used on the website. Note that this .csd will not play back correctly using Csound since it uses variables that are expected to be defined by the website's JavaScript context.
1. `DawPlayback.configured.csd` is the same as `DawPlayback.csd` but the JavaScript variables are replaced with their values. This .csd should work in Csound.
1. `DawPlayback.json` contains the data used for triggering the graphics in BabylonJs.
1. `DawPlayback.min.json` is a minified version of `DawPlayback.json`.

### Build web content
- Run the following commands to build the web content:
    ```
    npm install
    npm run build
    ```

- To start the webpack dev server run command:
    ```
    npm run start
    ```
