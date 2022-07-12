
const RimMesh = require('./Common/RimMesh')

class Rim2HiLineMesh extends RimMesh {
    scaling = 2
    y = 500
    segments = 240
    rows = 6
    segmentRadius = 500
    segmentCenterY = 250
    rowAngle = 1 // degrees
}

module.exports = new Rim2HiLineMesh
