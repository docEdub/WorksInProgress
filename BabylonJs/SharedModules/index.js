
const modulePaths = [
    'Meshes/Rim1HiArpMesh',
    'Meshes/Rim2HiLineMesh',
    'Meshes/Rim3LoLineMesh',
    'Paths/Flyer1Path',
    'Paths/Flyer2Path',
    'Paths/Flyer3Path'
]

for (let i = 0; i < modulePaths.length; i++) {
    const modulePath = modulePaths[i]
    const object = modulePath.split('/').pop()
    module.exports[object] = require(`./${modulePath}`)
}
