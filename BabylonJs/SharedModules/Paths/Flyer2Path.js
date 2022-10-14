
const FlyerPath = require('./Common/FlyerPath')

class Flyer2Path extends FlyerPath {
    name = "Flyer2Path"
    height = 240 // above center of main pyramid mesh's top piece
    startRotation = 120 // degrees
}

module.exports = new Flyer2Path
