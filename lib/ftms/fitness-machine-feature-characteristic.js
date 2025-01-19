// Main Code is from FortiusANT project and modified to suit Zwack
// https://github.com/WouterJD/FortiusANT/tree/master/node
const bleno = require("bleno");
const debugFTMS = require("debug")("ftms");
const parseArgs = require("minimist");
const args = parseArgs(process.argv.slice(2));

var containsFTMSBike = args.variable.includes("ftms-bike");
var containsFTMSTreadmill = args.variable.includes("ftms-treadmill");

function bit(nr) {
  return 1 << nr;
}

const AverageSpeedSupported = bit(0);
const CadenceSupported = bit(1);
const TotalDistanceSupported = bit(2);
const InclinationSupported = bit(3);
const PaceSupported = bit(5);
const HeartRateMeasurementSupported = bit(10);
const PowerMeasurementSupported = bit(14);

const PowerTargetSettingSupported = bit(3);
const IndoorBikeSimulationParametersSupported = bit(13);

const CharacteristicUserDescription = "2901";
const FitnessMachineFeature = "2ACC";

class FitnessMachineFeatureCharacteristic extends bleno.Characteristic {
  constructor() {
    debugFTMS(
      "[" +
        FitnessMachineFeature +
        "][FitnessMachineFeatureCharacteristic] constructor"
    );
    super({
      uuid: FitnessMachineFeature,
      properties: ["read"],
      descriptors: [
        new bleno.Descriptor({
          uuid: CharacteristicUserDescription,
          value: "Fitness Machine Feature",
        }),
      ],
    });
  }

  onReadRequest(offset, callback) {
    debugFTMS(
      "[" +
        FitnessMachineFeature +
        "][FitnessMachineFeatureCharacteristic] onReadRequest"
    );
    let flags = new Buffer.alloc(8);
    if (containsFTMSBike) {
      flags.writeUInt32LE(
        CadenceSupported |
          PowerMeasurementSupported |
          HeartRateMeasurementSupported
      );
    } else if (!containsFTMSBike && containsFTMSTreadmill) {
      flags.writeUInt32LE(
        AverageSpeedSupported |
          CadenceSupported |
          TotalDistanceSupported |
          InclinationSupported |
          PaceSupported
      );
    } else if (containsFTMSBike && containsFTMSTreadmill) {
      flags.writeUInt32LE(
        PowerMeasurementSupported |
          HeartRateMeasurementSupported |
          AverageSpeedSupported |
          CadenceSupported |
          TotalDistanceSupported |
          InclinationSupported |
          PaceSupported
      );
    }
    flags.writeUInt32LE(
      IndoorBikeSimulationParametersSupported | PowerTargetSettingSupported,
      4
    );
    callback(this.RESULT_SUCCESS, flags);
  }
}

module.exports = FitnessMachineFeatureCharacteristic;
