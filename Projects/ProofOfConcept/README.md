
---
# Build

I currently only build on macOS. Feel free to submit pull requests for other operating systems.

### Build Csound content
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

- To see `make` targets run command:
    ```
    node make help
    ```

The .csd files and plugins will be generated in `[...]/Projects/ProofOfConcept/Csound/_.output`.

If plugin options are enabled in CMake, the build generates them from the .csd files using Cabbage.
<br><br>
VST3 plugins should work with Reaper since that's what I use.<br>
Stereo AU plugins might still work but probably not. I gave up on them a while ago because I couldn't get 6 channel AU
output working.

### Build and debug web content
- Run the following commands to build the web content:
    ```
    npm install
    npm run build
    ```

- To start the webpack dev server run command:
    ```
    npm run start
    ```

- Debug in VS Code with the "Debugger for Chrome" extension.

- Debug on Oculus Quest following these instructions ...
  - Install Android SDK platform tools on Mac:
      ```
      brew install android-platform-tools --cask
      ```
  - Plug Quest into Mac with USB-C cable (Oculus power cable works).
  - On Quest, respond to permissions prompt(s).
  - On Mac, run command `adb devices`. If device is listed as `unauthorized`, go back on Quest and respond to another permissions prompt.
  - On Mac, run `adb tcp:9000 tcp:9000` to setup port forwarding from Quest to Mac.
  - On Quest browser, open `https://localhost:9000`
  - On Mac, open Chrome tab to `chrome://inspect/#devices` and select `Quest 2 -> ProofOfConcept -> inspect`. This should open a dev tools window on Mac with a screen view on the left and the usual Chrome dev tools on the right (Console, Elements, etc...).