const bleno = require("@abandonware/bleno");
const EventEmitter = require("events");

const debugBLE = require("debug")("ble");
const debugRSC = require("debug")("rsc");
const debugCSP = require("debug")("csp");
const debugFTMS = require("debug")("ftms");
const debugHeartRate = require("debug")("hr");
const parseArgs = require("minimist");

const args = parseArgs(process.argv.slice(2));

var containsFTMSBike = false;
var containsFTMSTreadmill = false;
var containsFTMSRow = false;
var containsRSC = false;
var containsCSP = false;
var containsHR = false;
var servicesOfferedArray = ["180A"]; // Device Information Service is offered by default

if (args.variable === undefined) {
  // DO Nothing - How do I bypass this? using "!" doesn't work
} else {
  containsFTMSBike = args.variable.includes("ftms-bike");
  containsFTMSTreadmill = args.variable.includes("ftms-treadmill");
  containsFTMSRow = args.variable.includes("ftms-row");
  containsRSC = args.variable.includes("rsc");
  containsCSP = args.variable.includes("csp");
  containsHR = args.variable.includes("heartrate");

  // Selectively build the array of Services which we offer/broadcast
  if (containsFTMSBike || containsFTMSTreadmill || containsFTMSRow) {
    servicesOfferedArray[servicesOfferedArray.length] = "1826";
  }
  if (containsCSP) {
    servicesOfferedArray[servicesOfferedArray.length] = "1818";
  }
  if (containsRSC) {
    servicesOfferedArray[servicesOfferedArray.length] = "1814";
  }
  if (containsHR) {
    servicesOfferedArray[servicesOfferedArray.length] = "180D"; //heart rate;
    servicesOfferedArray[servicesOfferedArray.length] = "180F"; //battery;
  }
}

const DeviceInformationService = require("./dis/device-information-service");
const CyclingPowerService = require("./cps/cycling-power-service");
const RSCService = require("./rsc/rsc-service");
const FTMSService = require("./ftms/fitness-machine-service");
const HeartRateService = require("./heartrate/heartrate-service");
const BatteryService = require("./battery/battery-service");

class ZwackBLE extends EventEmitter {
  constructor(options) {
    super();

    this.name = options.name || "Zwack";
    process.env["BLENO_DEVICE_NAME"] = this.name;

    this.csp = new CyclingPowerService();
    this.dis = new DeviceInformationService(options);
    this.rsc = new RSCService();
    this.ftms = new FTMSService();
    this.hr = new HeartRateService();
    this.batt = new BatteryService();

    this.last_timestamp = 0;
    this.rev_count = 0;

    let self = this;

    bleno.on("stateChange", (state) => {
      debugBLE(`[${this.name} stateChange] new state: ${state}`);

      self.emit("stateChange", state);

      if (state === "poweredOn") {
        bleno.startAdvertising(self.name, servicesOfferedArray);
      } else {
        debugBLE("Stopping...");
        bleno.stopAdvertising();
      }
    });

    bleno.on("advertisingStart", (error) => {
      debugBLE(
        `[${this.name} advertisingStart] ${
          error ? "error " + error : "success"
        }`
      );
      self.emit("advertisingStart", error);

      if (!error) {
        var services = [];
        services.push(self.dis);
        if (containsFTMSBike || containsFTMSTreadmill || containsFTMSRow) {
          services.push(self.ftms);
        }
        if (containsCSP) {
          services.push(self.csp);
        }
        if (containsRSC) {
          services.push(self.rsc);
        }
        if (containsHR) {
          services.push(self.hr);
          services.push(self.batt);
        }
        bleno.setServices(services, (error) => {
          debugBLE(
            `[${this.name} setServices] ${error ? "error " + error : "success"}`
          );
        });
      }
    });

    bleno.on("advertisingStartError", () => {
      debugBLE(`[${this.name} advertisingStartError] advertising stopped`);
      self.emit("advertisingStartError");
    });

    bleno.on("advertisingStop", (error) => {
      debugBLE(
        `[${this.name} advertisingStop] ${error ? "error " + error : "success"}`
      );
      self.emit("advertisingStop");
    });

    bleno.on("servicesSet", (error) => {
      debugBLE(
        `[${this.name} servicesSet] ${error ? "error " + error : "success"}`
      );
    });

    bleno.on("accept", (clientAddress) => {
      debugBLE(`[${this.name} accept] Client: ${clientAddress}`);
      self.emit("accept", clientAddress);
      bleno.updateRssi();
    });

    bleno.on("rssiUpdate", (rssi) => {
      debugBLE(`[${this.name} rssiUpdate]: ${rssi}`);
    });

    // start the ping
    //this.ping();
  }

  notifyCSP(event) {
    debugCSP(`[${this.name} notifyCSP] ${JSON.stringify(event)}`);

    this.csp.notify(event);

    if (!("watts" in event) && !("heart_rate" in event)) {
      debugCSP("[" + this.name + " notify] unrecognized event: %j", event);
    } else {
      if ("rev_count" in event) {
        this.rev_count = event.rev_count;
        // debugCSP('zwack_ble_sensor.js - rev_count');
      }

      // 			if ('wheel_count' in event) {
      // 				this.wheel_count = event.wheel_count;
      // debugCSP('zwack_ble_sensor.js - wheel_count');
      // 			}
      this.last_timestamp = Date.now();
    }
  }

  notifyFTMS(event) {
    debugFTMS(`[${this.name} notifyFTMS] ${JSON.stringify(event)}`);

    this.ftms.notify(event);

    if (
      !("watts" in event) &&
      !("speed" in event) &&
      !("stroke_rate" in event) && 
      !("heart_rate" in event)
    ) {
      debugFTMS("[" + this.name + " notify] unrecognized event: %j", event);
    } else {
      if ("rev_count" in event) {
        this.rev_count = event.rev_count;
      }
      this.last_timestamp = Date.now();
    }
  }

  notifyRSC(event) {
    debugRSC(`[${this.name} notifyRSC] ${JSON.stringify(event)}`);

    this.rsc.notify(event);

    if (!("speed" in event) && !("cadence" in event)) {
      debugRSC("[" + this.name + " notifyRSC] unrecognized event: %j", event);
    }
  }

  notifyHeartRate(event) {
    debugHeartRate(`[${this.name} notifyHeartRate] ${JSON.stringify(event)}`);

    this.hr.notify(event);

    if (!("heart_rate" in event)) {
      debugHeartRate(
        "[" + this.name + " notifyHeartRate] unrecognized event: %j",
        event
      );
    }
  }

  ping() {
    const TIMEOUT = 4000;
    let self = this;

    setTimeout(() => {
      // send a zero event if we don't hear for 4 seconds (15 rpm)
      if (Date.now() - self.last_timestamp > TIMEOUT) {
        self.notifyCSP({
          heart_rate: 0,
          watts: 0,
          rev_count: self.rev_count,
        });
      }
      this.ping();
    }, TIMEOUT);
  }
}

module.exports = ZwackBLE;
