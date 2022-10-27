
- Fix disabling audio when browser tab is inactive.

- Fix 3dof audio cutting out after exiting immersive mode on Quest 2.

- Investigate frozen immersive view on Quest Pro when hand tracking is enabled and hand is detected.
    - 221027: Babylon.js internal issue created. Raanan says he can look at it in a week or so.

- Add the Rim mesh .js files as dependencies to a CMake command target for calling CMake configure on the common Rim mesh .orc file instead of forcing CMake configure in make.js.
