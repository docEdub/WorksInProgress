
- Fix comment stripper so it doesn't strip urls like https://github.com/resonance-audio/resonance-audio-web-sdk.

- Investigate Csound WASM memory access out of bounds when preallocating too many instruments.
    Chrome console shows the following error when attempting to preallocate 50-ish instruments.
    Uncaught RuntimeError: memory access out of bounds
        at useropcdset (<anonymous>:wasm-function[3308]:0x1bf488)
        at init_pass (<anonymous>:wasm-function[3281]:0x1bb872)
        at insert_event (<anonymous>:wasm-function[3283]:0x1bcaaf)
        at insert (<anonymous>:wasm-function[3290]:0x1bd958)
        at process_score_event (<anonymous>:wasm-function[3734]:0x1f116d)
        at process_rt_event (<anonymous>:wasm-function[3733]:0x1f0aa1)
        at sensevents (<anonymous>:wasm-function[3731]:0x1eff8c)
        at csoundPerformKsmpsWasi (<anonymous>:wasm-function[2572]:0x16c6d6)
        at Object.csoundPerformKsmps
