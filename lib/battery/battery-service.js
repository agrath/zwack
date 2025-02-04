const Bleno = require("@abandonware/bleno");

const StaticReadCharacteristic = require("../read-characteristic");

class BatteryService extends Bleno.PrimaryService {
  constructor() {
    super({
      uuid: "180F",
      characteristics: [
        new StaticReadCharacteristic("2A19", "Battery measurement", [75]), // 75%
      ],
    });
  }

  notify(event) {
    return this.RESULT_SUCCESS;
  }
}

module.exports = BatteryService;
