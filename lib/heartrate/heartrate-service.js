const Bleno = require('@abandonware/bleno');

const HeartRateMeasurementCharacteristic = require('./heartrate-measurement-characteristic');

class HeartRateService extends Bleno.PrimaryService {

  constructor() {
    let heartRateMeasurement = new HeartRateMeasurementCharacteristic();
    super({
      uuid: '180D',
      characteristics: [
        heartRateMeasurement
      ]
    });

    this.heartRateMeasurement = heartRateMeasurement;
  }

  notify(event) {
    this.heartRateMeasurement.notify(event);
    return this.RESULT_SUCCESS;
  };
}

module.exports = HeartRateService;
