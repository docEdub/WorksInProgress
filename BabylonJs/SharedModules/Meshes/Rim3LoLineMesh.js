
const RimMesh = require('./Common/RimMesh')

class Rim3LoLineMesh extends RimMesh {
    scaling = 2
    y = 200
    segments = 240
    rows = 6
    segmentRadius = 400
    segmentCenterY = 250
    rowAngle = 1 // degrees
}

module.exports = new Rim3LoLineMesh
