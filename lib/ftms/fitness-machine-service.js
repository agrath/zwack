// Main Code is from FortiusANT project and modified to suit Zwack
// https://github.com/WouterJD/FortiusANT/tree/master/node
const bleno = require("@abandonware/bleno");
const debugFTMS = require("debug")("ftms");
const config = require("../config");

const FitnessMachineFeatureCharacteristic = require("./fitness-machine-feature-characteristic");
const IndoorBikeDataCharacteristic = require("./fitness-machine-indoor-bike-data-characteristic");
const RowerDataCharacteristic = require("./fitness-machine-rower-data-characteristic");
const FitnessMachineControlPointCharacteristic = require("./fitness-machine-control-point-characteristic");
const SupportedPowerRangeCharacteristic = require("./supported-power-range-characteristic");
const FitnessMachineStatusCharacteristic = require("./fitness-machine-status-characteristic");
const TreadmillDataCharacteristic = require("./fitness-machine-treadmill-data-characteristic");
const SupportedSpeedRangeCharacteristic = require("./supported-speed-range-characteristic");
const SupportedInclinationRangeCharacteristic = require("./supported-inclination-range-characteristic");
const SupportedResistanceLevelRangeCharacteristic = require("./supported-resistance-level-range-characteristic");

const FitnessMachine = "1826";

var containsFTMSBike = config.has("ftms-bike");
var containsFTMSTreadmill = config.has("ftms-treadmill");
var containsFTMSRow = config.has("ftms-row");
var containsFTMSControl = config.has("ftms-control");

class FitnessMachineService extends bleno.PrimaryService {
  constructor(messages, onTargetChanged) {
    debugFTMS("[FitnessMachineService] constructor");
    let fmfc = new FitnessMachineFeatureCharacteristic();
    let ibdc = new IndoorBikeDataCharacteristic();
    let tmdc = new TreadmillDataCharacteristic();
    let rdc = new RowerDataCharacteristic();
    let fmsc = new FitnessMachineStatusCharacteristic();
    let fmcpc = new FitnessMachineControlPointCharacteristic(messages, fmsc, onTargetChanged);
    let sprc = new SupportedPowerRangeCharacteristic();
    let ssrc = new SupportedSpeedRangeCharacteristic();
    let sirc = new SupportedInclinationRangeCharacteristic();
    let srlrc = new SupportedResistanceLevelRangeCharacteristic();
    var characteristics = [fmfc];
    if (containsFTMSBike) {
      characteristics.push(ibdc);
      characteristics.push(sprc);
      characteristics.push(srlrc);
    }
    if (containsFTMSTreadmill) {
      characteristics.push(tmdc);
      characteristics.push(ssrc);
      characteristics.push(sirc);
    }
    if (containsFTMSRow) {
      characteristics.push(rdc);
      characteristics.push(sprc);
    }
    if (containsFTMSControl) {
      characteristics.push(fmsc);
      characteristics.push(fmcpc);
    }

    super({
      uuid: FitnessMachine,
      characteristics: characteristics,
    });

    this.fmfc = fmfc;
    this.fmsc = fmsc;
    this.fmcpc = fmcpc;
    this.sprc = sprc;

    if (containsFTMSBike) {
      this.ibdc = ibdc;
    }
    if (containsFTMSTreadmill) {
      this.tmdc = tmdc;
    }
    if (containsFTMSRow) {
      this.rdc = rdc;
    }
  }

  notify(event) {
    debugFTMS("[" + FitnessMachine + "][FitnessMachineService] notify");
    if (containsFTMSBike) {
      this.ibdc.notify(event);
    }
    if (containsFTMSTreadmill) {
      this.tmdc.notify(event);
    }
    if (containsFTMSRow) {
      this.rdc.notify(event);
    }

    return this.RESULT_SUCCESS;
  }
}

module.exports = FitnessMachineService;
