var fs = require('fs')
var os = require('os');
var path = require('path');
var spawnSync = require('child_process').spawnSync;
const readSharedModule = require('./BabylonJs/SharedModules/read.js')

const csoundDir = path.resolve('Csound');
const dawPlaybackSourceDir = path.join(csoundDir, 'DawPlayback')
const buildDir = path.join(csoundDir, '/build');
const mixdownDir = path.join(buildDir, '/mixdown');
const playbackDir = path.join(buildDir, '/playback');
const bounceDir = path.join(buildDir, '/bounce');
const jsonDir = path.join(bounceDir, '/json');
const bounceMixdownDir = path.join(bounceDir, '/mixdown');
const babylonJsDir = path.resolve('BabylonJs')

const updateProjectCsd = () => {
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

    // Remove leading whitespace.
    data = data.replace(/\r?\n\s*/g, '\r\n')

    // Wrap with Javascript multiline string variable named `csdText`.
    let output = 'const csdText = `' + data + '`'

    // Update BabylonJs/project.ts csdText variable.
    data = fs.readFileSync(path.join(babylonJsDir, '/project.csd.ts'), 'ascii')
    data = data.replace(new RegExp('const csdText = `[^`]*`', 'g'), output)
    fs.writeFileSync(babylonJsDir + '/project.csd.ts', data, 'ascii')
    console.log('-- Updating BabylonJs/project.csd.ts `csdText` - done')
}

if (os.type() === 'Darwin') {
    spawnSync('bash', [ '-c', 'cmake -B ' + playbackDir + ' -S ' + csoundDir + ' -D BUILD_PLAYBACK_CSD=ON -D BUILD_MIXDOWN_CSD=OFF' ], {
        stdio: 'inherit'
    });
    spawnSync('bash', [ '-c', 'cd ' + playbackDir + ' && make 2>&1' ], {
        stdio: 'inherit'
    });

    updateProjectCsd()

    // Remove the configured playback .csd.
    const configuredPlaybackCsdPath = path.join(csoundDir, 'build', 'bounce', 'DawPlayback.configured.csd')
    if (fs.existsSync(configuredPlaybackCsdPath)) {
        fs.rmSync(configuredPlaybackCsdPath)
    }

    // Replace all configuration variables in playback .csd. Configuration variables = ${.*}
    let data = fs.readFileSync(path.join(csoundDir, 'build', 'bounce', 'DawPlayback.csd'), 'ascii')
    const matches = data.match(/\$\{.*\}/g)
    for (let i = 0; i < matches.length; i++) {
        const match = matches[i]
        data = data.replaceAll(match, readSharedModule(match))
    }
    fs.writeFileSync(bounceDir + '/DawPlayback.configured.csd', data)

    if (process.argv.indexOf('--with-json') != -1) {
        // Wipe the json folder.
        if (fs.existsSync(jsonDir)) {
            fs.rmSync(jsonDir, { recursive: true });
        }
        fs.mkdirSync(jsonDir);

        // Generate DawPlayback.json
        spawnSync('bash', [ '-c', 'cd ' + bounceDir + ' && csound DawPlayback.configured.csd --control-rate=120 --omacro:IS_GENERATING_JSON=1 --smacro:IS_GENERATING_JSON=1' ], {
            stdio: 'inherit'
        });

        let jsonData = fs.readFileSync(bounceDir + '/DawPlayback.json', 'ascii')

        // Minify JSON data.
        jsonData = JSON.stringify(JSON.parse(jsonData))
        fs.writeFileSync(bounceDir + '/DawPlayback.min.json', jsonData)
    }

    if (process.argv.indexOf('--with-mixdown') != -1) {
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

        // Generate stereo mixdown .aif and 64 bit ambisonic .aif.
        spawnSync('bash', [ '-c', 'cd ' + bounceMixdownDir + ' && csound ' + bounceDir + '/DawPlayback.configured.csd --omacro:IS_MIXDOWN=1 --smacro:IS_MIXDOWN=1 --output=mixdown.aif' ], {
            stdio: 'inherit'
        });

        // Normalize 64 bit ambisonic .aif and split it into multiple 2 channel .aif files.
        spawnSync('bash', [ '-c', 'cd ' + bounceMixdownDir + '&& csound ' + dawPlaybackSourceDir + '/NormalizeAndSplitSpatialMixdown.csd --omacro:INPUT_FILE=mixdown-wyzx.aif' ], {
            stdio: 'inherit'
        })

        // Use ffmpeg to convert the split 2 channel .aif files into MP3 files.
        // See https://trac.ffmpeg.org/wiki/Encode/MP3.
        const ffmpeg_options = `-y -c:a libmp3lame -q:a 0`
        spawnSync('bash', [ '-c', `cd ${bounceMixdownDir} && ffmpeg -i normalized-01+02.aif ${ffmpeg_options} normalized-wy.mp3` ], { stdio: 'inherit' })
        spawnSync('bash', [ '-c', `cd ${bounceMixdownDir} && ffmpeg -i normalized-03+04.aif ${ffmpeg_options} normalized-zx.mp3` ], { stdio: 'inherit' })
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
