const bleno = require("@abandonware/bleno");
const debugFTMS = require("debug")("ftms");
const util = require("util");

const CharacteristicUserDescription = "2901";
const SupportedInclinationRange = "2AD5";

class SupportedInclinationRangeCharacteristic extends bleno.Characteristic {
  constructor() {
    debugFTMS("[SupportedInclinationRangeCharacteristic] constructor");
    super({
      uuid: SupportedInclinationRange,
      properties: ["read"],
      descriptors: [
        new bleno.Descriptor({
          uuid: CharacteristicUserDescription,
          value: "Supported Inclination Range",
        }),
      ],
    });
  }

  onReadRequest(offset, callback) {
    let buffer = new Buffer.alloc(6);
    let at = 0;

    let minimumInclination = 0;
    //Percent with a resolution of 0.1
    buffer.writeInt16LE(minimumInclination * 10, at);
    at += 2;

    let maximumInclination = 12;
    //Percent with a resolution of 0.1
    buffer.writeInt16LE(maximumInclination * 10, at);
    at += 2;

    let minimumIncrement = 1;
    //Percent with a resolution of 0.1
    buffer.writeUInt16LE(minimumIncrement * 10, at);
    at += 2;

    // For Ease Of Debugging
    let finalbuffer = buffer.slice(0, at);
    let minInclinationHex = buffer.slice(0, 2);
    let maxInclinationHex = buffer.slice(2, 4);
    let incInclinationHex = buffer.slice(4, 6);

    let minInclinationDec = finalbuffer.readInt16LE(0);
    let maxInclinationDec = finalbuffer.readInt16LE(2);
    let incInclinationDec = finalbuffer.readInt16LE(4);

    debugFTMS(
      "[" +
        SupportedInclinationRange +
        "][SupportedInclinationRangeCharacteristic] onReadRequest - " +
        util.inspect(finalbuffer)
    );
    debugFTMS(
      "[" +
        SupportedInclinationRange +
        "][SupportedInclinationRangeCharacteristic] onReadRequest - Min [HEX]" +
        util.inspect(minInclinationHex) +
        " [Decimal:" +
        minInclinationDec +
        "]"
    );
    debugFTMS(
      "[" +
        SupportedInclinationRange +
        "][SupportedInclinationRangeCharacteristic] onReadRequest - Max [HEX]" +
        util.inspect(maxInclinationHex) +
        " [Decimal:" +
        maxInclinationDec +
        "]"
    );
    debugFTMS(
      "[" +
        SupportedInclinationRange +
        "][SupportedInclinationRangeCharacteristic] onReadRequest - Inc [HEX]" +
        util.inspect(incInclinationHex) +
        " [Decimal:" +
        incInclinationDec +
        "]"
    );
    callback(this.RESULT_SUCCESS, buffer);
  }
}

module.exports = SupportedInclinationRangeCharacteristic;
