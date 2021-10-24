
# 360 video creation

- Render an equirectangular 360 view from each eye and stack one eye on top of the other in a single frame.
    - See https://youtu.be/ND8T5_VCcN0?t=464
    - See https://github.com/imgntn/j360 for how to render an equirectangular 360 view for one eye using an old version of threejs.

- ffmpeg settings:
    - http://echeng.com/articles/encoding-for-oculus-media-studio/
    - https://www.youtube.com/watch?v=a4Wm2yX1q2o&ab_channel=HughHou
        ```
        Here are the MAX video specs:
        - 8192x4096 / 60fps h265 
        - 8192x4096 / 30fps h264 
        - 5760x5760 / 60fps h265 
        - 5760x5760 / 60fps h265 and h264 
        Recommanded: 7200x3600 / 60fps h265 with 100Mpbs bitrate

        Download my test samples for your Quest 2: 
        https://bit.ly/2HlnEWV
        Sample pack includes 8K 30fps and 8K 60fps shot on the Insta360 Titan, 6K 60fps shot on the Z Cam K2Pro, and a black level test in 10-bit from a real stage.

        FFMPEG command (updated): 
        H.264
        +++++++++++++++++++
        ffmpeg -i "input.mov" -c:v libx264 -preset slow -crf 18 -maxrate 100M -bufsize 200M -pix_fmt yuv420p -an -movflags faststart "output.mp4"
        +++++++++++++++++++
        H.265 / HEVC
        +++++++++++++++++++
        ffmpeg -i "input.mov" -c:v libx265 -preset slow -crf 18 -maxrate 100M -bufsize 200M -pix_fmt yuv420p -an -movflags faststart "output.mp4"
        +++++++++++++++++++
        ```