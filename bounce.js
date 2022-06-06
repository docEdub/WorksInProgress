var fs = require('fs')
var os = require('os');
var path = require('path');
var spawnSync = require('child_process').spawnSync;

const csoundDir = path.resolve('Csound');
const buildDir = path.join(csoundDir, '/build');
const mixdownDir = path.join(buildDir, '/mixdown');
const playbackDir = path.join(buildDir, '/playback');
const bounceDir = path.join(buildDir, '/bounce');
const jsonDir = path.join(bounceDir, '/json');
const bounceMixdownDir = path.join(bounceDir, '/mixdown');
const babylonJsDir = path.resolve('BabylonJs')

const updateBabylonJsProject = () => {
    let data = fs.readFileSync(path.join(csoundDir, 'build', 'bounce', 'DawPlayback.csd'), 'ascii')

    // Remove "-+rtmidi=null" option.
    data = data.replace('-+rtmidi=null', '')

    // Remove Cabbage xml element.
    data = data.replace('<Cabbage>', '')
    data = data.replace('</Cabbage>', '')

    // Escape backslashes.
    data = data.replace(/\\/g, '\\\\');

    // Remove lines starting with "//"".
    data = data.replace(/\s*\/\/.*\r?\n/g, os.EOL)

    // Remove lines starting with ";".
    data = data.replace(/\s*;.*\r?\n/g, os.EOL)

    // Remove blank lines.
    data = data.replace(/\s*\r?\n/g, os.EOL)

    // Replace leading whitespace with tabs.
    data = data.replace(/\r?\n\s*/g, '\r\n    ')

    // Wrap with Javascript multiline string variable named `csdText`.
    let output = 'const csdText = `' + data + '`'

    // Update BabylonJs/project.ts csdText variable.
    data = fs.readFileSync(path.join(babylonJsDir, '/project.ts'), 'ascii')
    data = data.replace(new RegExp('const csdText = `[^`]*`', 'g'), output)
    fs.writeFileSync(babylonJsDir + '/project.ts', data, 'ascii')
    console.log('-- Updating BabylonJs/project.ts `csdText` done')
}

if (os.type() === 'Darwin') {
    spawnSync('bash', [ '-c', 'cmake -B ' + playbackDir + ' -S ' + csoundDir + ' -D BUILD_PLAYBACK_CSD=ON -D BUILD_MIXDOWN_CSD=OFF' ], {
        stdio: 'inherit'
    });
    spawnSync('bash', [ '-c', 'cd ' + playbackDir + ' && make 2>&1' ], {
        stdio: 'inherit'
    });

    updateBabylonJsProject()

    if (process.argv.indexOf('--with-json') != -1) {
        // Wipe the json folder.
        if (fs.existsSync(jsonDir)) {
            fs.rmSync(jsonDir, { recursive: true });
        }
        fs.mkdirSync(jsonDir);

        // Generate DawPlayback.json
        spawnSync('bash', [ '-c', 'cd ' + bounceDir + ' && csound DawPlayback.csd --control-rate=120 --omacro:IS_GENERATING_JSON=1 --smacro:IS_GENERATING_JSON=1' ], {
            stdio: 'inherit'
        });

        let jsonData = fs.readFileSync(bounceDir + '/DawPlayback.json', 'ascii')

        // Minify JSON data.
        jsonData = JSON.stringify(JSON.parse(jsonData))
        fs.writeFileSync(bounceDir + '/DawPlayback.min.json', jsonData)

        // Wrap JSON data with Javascript multiline string variable named `csdJson`.
        let output = 'const csdJson = `\n    ' + jsonData + '\n    `'

            // Update BabylonJs/project.ts csdJson variable.
        let data = fs.readFileSync(babylonJsDir + '/project.ts', 'ascii')

        data = data.replace(new RegExp('const csdJson = `[^`]*`', 'g'), output)
        fs.writeFileSync(babylonJsDir + '/project.ts', data, 'ascii')
        console.log('-- Updating BabylonJs/project.ts `csdJson` done')
    }

    if (process.argv.indexOf('--mixdown') != -1) {
        spawnSync('bash', [ '-c', 'cmake -B ' + mixdownDir + ' -S ' + csoundDir + ' -D BUILD_PLAYBACK_CSD=ON -D BUILD_MIXDOWN_CSD=ON' ], {
            stdio: 'inherit'
        });
        spawnSync('bash', [ '-c', 'cd ' + mixdownDir + ' && make 2>&1' ], {
            stdio: 'inherit'
        });

        // Wipe the mixdown folder.
        if (fs.existsSync(bounceMixdownDir)) {
            fs.rmSync(bounceMixdownDir, { recursive: true })
        }
        fs.mkdirSync(bounceMixdownDir);

        // Generate stereo mixdown bounce .wav file.
        spawnSync('bash', [ '-c', 'cd ' + bounceMixdownDir + ' && csound ' + bounceDir + '/DawPlayback.csd --smacro:IS_MIXDOWN=1 --output=mixdown.aif' ], {
            stdio: 'inherit'
        });
    }
}
else if (os.type() == "Windows_NT") {
    spawnSync('cmd', [ '/c', 'cmake -B ' + playbackDir + ' -S ' + csoundDir + ' -D BUILD_PLAYBACK_CSD=ON -D BUILD_MIXDOWN_CSD=OFF' ], {
        stdio: 'inherit'
    });
    spawnSync('cmd', [ '/c', 'cd ' + playbackDir + ' && CMake --build . 2>&1' ], {
        stdio: 'inherit'
    });

    updateBabylonJsProject()
}
else {
    throw new Error('Unsupported OS: ' + os.type())
}
