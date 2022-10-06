/// --------------------------------------------------------------------------------------------------------------------
/// This is a node.js script that returns the value of the shared module object property given in the CLI arguments.
/// The given argument should be string containing an object and property name joined by a dot ...
/// Example call:
///     const value = read('Rim1HiArpMesh.audioPositionsString')
/// --------------------------------------------------------------------------------------------------------------------

const SharedModules = require('.')

module.exports = (arg) => {
    if (arg === undefined) {
        process.stderr.write(`Error: object property argument is required.\n`)
        return arg
    }

    if (arg.startsWith('${')) {
        arg = arg.slice(2)
    }
    if (arg.startsWith('SHARED.')) {
        arg = arg.slice(7)
    }
    if (arg.endsWith('}')) {
        arg = arg.slice(0, -1)
    }

    const keys = arg.split('.')
    const objectKey = keys[0]
    const propertyKey = keys[1]

    const object = SharedModules[keys[0]]
    if (object === undefined) {
        process.stderr.write(`Error: \`${objectKey}\` is not a shared module object.\n`)
        return arg
    }

    const value = object[propertyKey]
    if (value === undefined) {
        process.stderr.write(`Error: \`${propertyKey}\` is not a property of shared module object \`${objectKey}\`.\n`)
        return arg
    }

    return value
}
