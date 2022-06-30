/// --------------------------------------------------------------------------------------------------------------------
/// This is a node.js script that prints the value of the shared module object property given in the CLI arguments.
/// The CLI argument following `node read` should be an object and property name joined by a dot ...
/// Example command:
///     node BabylonJs/SharedModules/read Rim1Mesh.audioPositionsString
/// --------------------------------------------------------------------------------------------------------------------

const SharedModules = require('.')

const arg = process.argv[2]
if (arg === undefined) {
    process.stderr.write(`Error: object property argument is required.\n`)
    process.exit(1)
}

const keys = arg.split('.')
const objectKey = keys[0]
const propertyKey = keys[1]

const object = SharedModules[keys[0]]
if (object === undefined) {
    process.stderr.write(`Error: \`${objectKey}\` is not a shared module object.\n`)
    process.exit(2)
}

const value = object[propertyKey]
if (value === undefined) {
    process.stderr.write(`Error: \`${propertyKey}\` is not a property of shared module object \`${objectKey}\`.\n`)
    process.exit(3)
}

console.log(value)
process.exit(0)
