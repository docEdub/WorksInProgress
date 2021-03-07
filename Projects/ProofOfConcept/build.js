var spawn = require('child_process').spawn
var os = require('os')
var fs = require('fs')

if (os.type() === 'Darwin') {
    const csoundDir = 'Csound'
    const shell_buildDir = '_.build'
    const shell_optionsFile = 'CMakeOptions.cmake'
    const shell_cacheFile = shell_buildDir + '/CMakeCache.txt'
    const js_optionsFile = csoundDir + '/' + shell_optionsFile
    const js_cacheFile = csoundDir + '/' + shell_cacheFile
    const js_optionsDefaultFile = '../../Libraries/CsoundCMake/CMakeOptions.default.cmake'

    if (!fs.existsSync(js_optionsFile)) {
        fs.copyFileSync(js_optionsDefaultFile, js_optionsFile)
    }

    let shellCommand = 'cd ' + csoundDir

    // If options file was modified after cache file was configured, delete cache file to make CMake remake it.
    if (fs.existsSync(js_cacheFile)) {
        if (fs.statSync(js_cacheFile).mtime < fs.statSync(js_optionsFile).mtime) {
            shellCommand += ' && rm ' + shell_cacheFile
        }
    }

    shellCommand += ' && cmake -B ' + shell_buildDir + ' -C ' + shell_optionsFile + ' -D BUILD_PLAYBACK_CSD='
    shellCommand += process.argv.includes('BUILD_PLAYBACK_CSD') ? 'ON' : 'OFF'
    shellCommand += ' && cmake --build ' + shell_buildDir

    spawn('bash', [ '-c', shellCommand ], { stdio: 'inherit' })
}
else {
    throw new Error('Unsupported OS: ' + os.type())
}
