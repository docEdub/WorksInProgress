
### Playgrounds used for audio glitch testing

- 2021-06-13: https://playground.babylonjs.com/#SY0NY5
    - Me ...
        - Glitchy on Oculus Quest 2
    - Discord:**@De-Panther** ...
        - I have audio glitches on my Android phon in this page
        - (but when I try to record it the glitches are over)
        - Galaxy S10e, Android 11, latest chrome

- 2021-06-22: https://playground.babylonjs.com/#SY0NY5#1
    - Me ...
        - Not glitchy on Oculus Quest 2
    - Discord:**Sorskoot** ...
        - Just tested on my Android. Glitched a little bit at the start, but after that it ran fine. I'll test on some other devices later.
        - It's an older Samsung S8. It was Chrome 91.0.4472.101
        - Just have a quick run on my Quest 1 and Hololens 2. Both couldn't keep up and kept stuttering.

- 2021-06-23: https://playground.babylonjs.com/#SY0NY5#2
    - Title: **docEdub for quest 2 audio profiling - 2021-06-23 - 1**
        - Discord:**De-Panther** ...
            - Take lots of time till there's sound, and then it glitches
            - (assuming still on Galaxy S10e, Android 11, latest chrome)
        - Discord:**yinch** ...
            - Posted a video showing audio works glitch free on Huawei P30

- 2021-08-07: https://playground.babylonjs.com/#SY0NY5#4
    - Title: **ProofOfConcept - 2021-08-07--1113**
    - Posted to:
        - Twitter: https://twitter.com/docedub/status/1424047469378277378
        - WebXR Discord `show-off` channel: https://discord.com/channels/758943204715659264/759559568321282109/873606743660310568

- 2021-08-20: https://playground.babylonjs.com/#SY0NY5#5
    - Title: **ProofOfConcept - 2021-08-26--2019**
    - Posted to:
        - WebXR Discord `browser` channel: https://discord.com/channels/758943204715659264/805647111625375764/880609996277186590
    - Notes:
        - Works in Chrome.
        - Doesn't work in Quest 2. Hits mystery WASM memory limit?

- 2021-09-06: https://playground.babylonjs.com/#SY0NY5#6
    - Title: **ProofOfConcept - 2021-09-06--1719**
    - Posted to:
        - Twitter: https://twitter.com/docedub/status/1434994932704481290
        - Csound Discord `showcase` channel: https://discord.com/channels/784849854270537790/786239999259181073/884557106873774151
        - WebXR Discord `show-off` channel: https://discord.com/channels/758943204715659264/759559568321282109/884556318206214234
        - BabylonJS `Demos and Projects -> Programmers Corner` board: https://forum.babylonjs.com/t/programmers-corner/22892/89?u=docedub
        - BabylonJS `Demos and Projects` as a separate thread: https://forum.babylonjs.com/t/spatial-audio-experience-proofofconcept/23712
    - Notes:
        - Works around float allocation error by not restarting Csound score.
        - Has pre-made camera animation.
    - Testing results:
        - @slt on WebXR Discord tested on a HoloLens 2 and posted here: https://discord.com/channels/758943204715659264/759559637254275084/885153831841828915
            - Audio is a bit glitchy, about the same as on iOS Safari. Using panning for spatial audio might resolve this instead of using ambisonic convolutions.
            - FPS is about 10hz, which is not good. It's probably the glow effect causing this since it requires a 2-pass render to texture step, which is bad on mobile devices due to tiling (I think).
            - @slt sent a video using Google drive and I uploaded it to Vimeo at https://vimeo.com/600273627.

- 2021-10-10: https://playground.babylonjs.com/#SY0NY5#9
    - Title: **ProofOfConcept - 2021-10-10--2225**
    - Posted to:
        - Twitter: https://twitter.com/docedub/status/1447708212304678912
        - Csound Discord `showcase` channel: https://discord.com/channels/784849854270537790/786239999259181073/897267916775489556
        - WebXR Discord `show-off` channel: https://discord.com/channels/758943204715659264/759559568321282109/897268348121931836
        - BabylonJS `Demos and Projects` as a separate thread: https://forum.babylonjs.com/t/spatial-audio-experience-proofofconcept/23712/2

