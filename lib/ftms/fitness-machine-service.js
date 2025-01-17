// Main Code is from FortiusANT project and modified to suit Zwack
// https://github.com/WouterJD/FortiusANT/tree/master/node
const bleno = require('bleno');
const debugFTMS = require('debug')('ftms');

const FitnessMachineFeatureCharacteristic = require('./fitness-machine-feature-characteristic');
const IndoorBikeDataCharacteristic = require('./fitness-machine-indoor-bike-data-characteristic');
const FitnessMachineControlPointCharacteristic = require('./fitness-machine-control-point-characteristic');
const SupportedPowerRangeCharacteristic = require('./supported-power-range-characteristic');
const FitnessMachineStatusCharacteristic = require('./fitness-machine-status-characteristic');
const TreadmillDataCharacteristic = require('./fitness-machine-treadmill-data-characteristic');

const FitnessMachine = '1826'

var containsFTMSBike = args.variable.includes("ftms-bike");;
var containsFTMSTreadmill = args.variable.includes("ftms-treadmill");

class FitnessMachineService extends bleno.PrimaryService {
  constructor(messages) {
    debugFTMS('[FitnessMachineService] constructor');
    let fmfc = new FitnessMachineFeatureCharacteristic();
    let ibdc = new IndoorBikeDataCharacteristic();
    let tmdc = new TreadmillDataCharacteristic();
    let fmsc = new FitnessMachineStatusCharacteristic();
    let fmcpc = new FitnessMachineControlPointCharacteristic(messages, fmsc);
    let sprc = new SupportedPowerRangeCharacteristic();
    var characteristics = [fmfc];
    if(containsFTMSBike)
    {
      this.ibdc = ibdc;
      characteristics.push(ibdc);
      characteristics.push(sprc);
    }
    if(containsFTMSTreadmill)
    {
      this.tmdc = tmdc;
      characteristics.push(tmdc);
    }
    characteristics.push(fmsc);
    characteristics.push(fmcpc);
    
    super({
      uuid: FitnessMachine,
      characteristics: characteristics
    });

    this.fmfc = fmfc;
    this.fmsc = fmsc;
    this.fmcpc = fmcpc;
    this.sprc = sprc;
  }

  notify(event) {
    debugFTMS('[' + FitnessMachine + '][FitnessMachineService] notify')
    if(containsFTMSBike)
    {
      this.ibdc.notify(event);
    }
    if(containsFTMSTreadmill)
    {
      this.tmdc.notify(event);
    }
    return this.RESULT_SUCCESS;
  };
}

module.exports = FitnessMachineService;
