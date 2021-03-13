var spawn = require('child_process').spawn
var os = require('os')
var fs = require('fs')
var path = require('path')

if (os.type() === 'Darwin') {
    const csoundDir = path.resolve('Csound')
    const buildDir = csoundDir + '/_.build'
    const optionsFile = csoundDir + '/CMakeOptions.cmake'
    const cacheFile = buildDir + '/CMakeCache.txt'
    const optionsDefaultFile = path.resolve('../../Libraries/CsoundCMake/CMakeOptions.default.cmake')

    if (!fs.existsSync(optionsFile)) {
        fs.copyFileSync(optionsDefaultFile, optionsFile)
    }

    let command = 'cd ' + csoundDir

    // If options file was modified after cache file was configured, delete cache file so CMake remakes it.
    if (fs.existsSync(cacheFile)) {
        if (fs.statSync(cacheFile).mtime < fs.statSync(optionsFile).mtime) {
            command += ' && rm ' + cacheFile
        }
    }

    command += ' && cmake -B ' + buildDir + ' -C ' + optionsFile
        + ' -D BUILD_PLAYBACK_CSD=' + (process.argv.includes('BUILD_PLAYBACK_CSD') ? 'ON' : 'OFF')
        + ' -D FOR_PLAYBACK_CSD=' + (process.argv.includes('FOR_PLAYBACK_CSD') ? 'ON' : 'OFF')
        + ' && cmake --build ' + buildDir

    spawn('bash', [ '-c', command ], { stdio: 'inherit' })
}
else {
    throw new Error('Unsupported OS: ' + os.type())
}
