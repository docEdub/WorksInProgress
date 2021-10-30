
# 1-ProofOfConcept

This project is a hacked together proof-of-concept. It works, but it's a mess. I don't recommend using it for anything.

## Build

I currently only build on macOS. 

### Build Csound content
- Install Xcode command line tools for clang, and install Node, CMake, Csound 6.16.0, and Cabbage 2.5.12. Make sure
  `clang`, `node` and `cmake` are on the PATH.
- In the `1-ProofOfConcept` folder, run commands:
    ```
    node configure
    node make
    ```
- To change the build options run command:
    ```
    node make edit_cache
    ```
- To see `make` targets run command:
    ```
    node make help
    ```
- To build the VST3 plugins run command:
    ```
    node make vst3
    ```

The .csd files and plugins will be generated in `1-ProofOfConcept/Csound/build`.

If any of the above commands fail, try running them again. They may work the 2nd time.

VST3 plugins should work with Reaper since that's what I use.

### Bounce Reaper projects to monolith Csound .csd
- In Cabbage, open `Csound/build/included-output/DawService.csd` and start it.
- In the Cabbage UI for DawService.csd make sure "Mode 1" is selected and open a Reaper project that uses the VST3
  plugins built earlier.
- If the Reaper project opens successfully, switch to "Mode 2" and play the Reaper project for a few seconds. This will
  generate the Csound files needed to bounce the track and plugin chains.
- Switch to "Mode 3" and play the Reaper project for a few seconds again to generate the Csound files for track
  send/volume levels and automations.
- Switch to "Mode 4" and play the entire Reaper project to generate the Csound score.
- When done, switch back to "Mode 1" for normal playback.

If everything went smoothly then you should be able to bounce all the generated Csound files into a monolithic .csd with
the following command:
```
node bounce --with-json
```

This will create 3 files in the `Csound/build/bounce` folder:
1. `DawPlayback.csd` is the raw monolithic .csd.
1. `DawPlayback.csd.js` is a minified version of the monolithic .csd I use to paste into `BabylonJs/project.ts`.
1. `DawPlayback.json` is used for triggering the graphics in BabylonJs. It gets pasted into `BabylonJs/project.ts`, too.

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
