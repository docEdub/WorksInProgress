var os = require('os');
var path = require('path');
var spawn = require('child_process').spawn;

if (os.type() === 'Darwin') {
    const csoundDir = path.resolve('Csound')
    const buildDir = csoundDir + '/_.build'
    spawn('bash', [ '-c', 'cd ' + buildDir + ' && make ' + process.argv.slice(2).join(' ')], { stdio: 'inherit' })
}
else {
    throw new Error('Unsupported OS: ' + os.type())
}
