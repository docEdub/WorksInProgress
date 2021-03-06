
---
# Build

I currently only build on macOS. I used to build on Windows so there are some individual Windows commands in the CMake
scripts that might still work but the Windows build as a whole is probably broken.

## Mac build:
- Install Xcode command line tools.
- Install CMake and add `cmake` binary to PATH. (Not the `CMake.app`, the actual `cmake` binary **in** the app)
- Install Csound.
- Install Csound Cabbage in default location: `/Applications/Cabbage.app`.
- In `[...]/Projects/ProofOfConcept` folder, run commands:
    - `npm ci`
    - `npm run build`

Build generates .csd files in `[...]/Projects/ProofOfConcept/Csound/_.output`.

To change CMake config after initial build, edit `[...]/Projects/ProofOfConcept/Csound/CMakeOptions.cmake` and
rebuild.

If plugin options are enabled, build generates them from .csd files with Cabbage.<br>
VST3 plugins should work with Reaper since that's what I use.<br>
Stereo AU plugins might still work but probably not. I gave up on them a while ago because I couldn't get 6 channel AU
output working.
