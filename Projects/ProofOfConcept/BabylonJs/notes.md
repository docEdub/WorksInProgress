## Quest 2
### AudioContext

- BabylonJS default:
    - sampleRate = 48000
    - baseLatency = 0.042666666666
    - sampleRate * baseLatency = 2048

- New with sampleRate = 48000 and latencyHint = 0.1
    - baseLatency = 0.128
    - sampleRate * baseLatency = 6144

- New with sampleRate = 48000 and latencyHint = 1
    - baseLatency = 0.17066666666
    - sampleRate * baseLatency = 8192

- Findings:
    - 8192 is the max buffer size on Quest 2 (baseLatency = 0.17066666666)
    - latencyHint of 0.170667 makes baseLatency get set to max.
