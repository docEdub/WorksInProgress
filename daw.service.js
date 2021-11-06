var os = require('os')
var path = require('path')
var spawnSync = require('child_process').spawnSync

if (os.type() === 'Darwin') {
    const csoundDir = path.resolve('Csound')
    const buildDir = csoundDir + '/build'
    const csdDir = buildDir + '/included-output'
    const csdFile = 'DawService.csd'

    // Cleanup previous DawPlayback.csd runs.
    spawnSync('bash', [ '-c', 'echo' ], { stdio: 'inherit' })
    spawnSync('bash', [ '-c', 'echo Killing previous DawPlayback.csd runs ...' ], { stdio: 'inherit' })
    spawnSync('bash', [ '-c', 'killall csound' ], { stdio: 'inherit' })
    spawnSync('bash', [ '-c', 'echo Killing previous DawPlayback.csd runs - done' ], { stdio: 'inherit' })

    // Start DawPlayback.csd
    spawnSync('bash', [ '-c', 'echo' ], { stdio: 'inherit' })
    spawnSync('bash', [ '-c', 'echo Running DawPlayback.csd ...' ], { stdio: 'inherit' })
    spawnSync('bash', [ '-c', 'cd ' + csdDir + ' && csound ' + csdFile ], { stdio: 'inherit' })
}
else {
    throw new Error('Unsupported OS: ' + os.type());
}
