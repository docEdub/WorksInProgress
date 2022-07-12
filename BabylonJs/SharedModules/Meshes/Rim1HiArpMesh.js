
const RimMesh = require('./Common/RimMesh')

class Rim1HiArpMesh extends RimMesh {
    scaling = 2
    y = 1500
    segments = 240
    rows = 3
    segmentRadius = 900
    segmentCenterY = 500
    rowAngle = 1 // degrees
}

module.exports = new Rim1HiArpMesh
