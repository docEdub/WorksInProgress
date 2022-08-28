
## Csound optimization notes - 220604
Description | DawPlayback.csd playback time
-|-
Using `dconv` | ~17600 ms
Using `pconvolve` | ~9600 ms
Using `ftconv` | ~9500 ms
Csound compiled with MSVC /fp:fast flag | ~7900 ms
Using a-rate smoothing for spatial audio calculations | ~10600 ms

## Csound profiling on macOS - 220821
Use `xctrace` in a terminal using the following command:
```
xctrace record --template 'Time Profiler' --launch -- /opt/homebrew/bin/csound Csound/build/bounce/DawPlayback.configured.csd -odac
```
This should log a .trace file in the current folder that opens with a double-click into the macOS Instruments app which can be used for viewing the CPU usage profiling data at selectable time windows.

NB: `xctrace` doesn't work from VS Code's terminal if it's x86_64 instead of arm due to Rosetta being used. The `xctrace` command doesn't work inside an app running under Rosetta.

NB: Use the homebrew version of Csound since it has all the function names in the binary.
