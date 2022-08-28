
const FlyerPath = require('./Common/FlyerPath')

class Flyer3Path extends FlyerPath {
    height = 250 // above center of main pyramid mesh's top piece
    startRotation = 240 // degrees
}

module.exports = new Flyer3Path