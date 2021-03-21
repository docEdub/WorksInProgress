
---
# Build

I currently only build on macOS. Feel free to submit a pull request for other operating systems.

## Mac build:
- Install Xcode command line tools for clang, and install Node, CMake, Csound, and Cabbage. Make sure `clang`, `node`
  and `cmake` are on the PATH.
- In `[...]/Projects/ProofOfConcept` folder, run commands:
    ```
    node configure
    node make
    ```
- To change the build options run command:
    ```
    node make edit_cache
    ```

The .csd files and plugins will be generated in `[...]/Projects/ProofOfConcept/Csound/_.output`.

If plugin options are enabled in CMake, the build generates them from the .csd files using Cabbage.<br>
VST3 plugins should work with Reaper since that's what I use.<br>
Stereo AU plugins might still work but probably not. I gave up on them a while ago because I couldn't get 6 channel AU
output working.
