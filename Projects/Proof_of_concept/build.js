var exec = require('child_process').exec
var os = require('os')
var fs = require('fs')

let command = ""

if (os.type() === 'Darwin') {
    if (!fs.existsSync("Csound/CMakeOptions.cmake")) {
        fs.copyFileSync("../../Libraries/CsoundCMake/CMakeOptions.default.cmake", "Csound/CMakeOptions.cmake")
    }

    command += "cd Csound"

    // If the options file was modified after the cache was configured, delete the cache file to reconfigure.
    if (fs.existsSync("Csound/_.build/CMakeCache.txt")) {
        let cacheTime = fs.statSync("Csound/_.build/CMakeCache.txt").mtime
        let optionsTime = fs.statSync("Csound/CMakeOptions.cmake").mtime
        if (cacheTime < optionsTime) {
            command += " && rm _.build/CMakeCache.txt"
        }
    }
    command += " && cmake -B _.build -C CMakeOptions.cmake"
    command += " && cmake --build _.build"
}
else {
    throw new Error("Unsupported OS: " + os.type())
}

exec(command, (error, stdout, stderr) => { console.log(stdout + '\n' + stderr) })
