// Centralised configuration parsed from command line arguments.
// Set by the simulator entry point, consumed by service/characteristic modules.

const config = {
  services: [],
  // Supported Inclination Range overrides (--incline-min / --incline-max), in percent; null uses the
  // machine's default (see supported-inclination-range-characteristic.js)
  inclineMin: null,
  inclineMax: null,
  has(service) {
    return this.services.includes(service);
  },
  // The Supported Inclination Range to publish, in percent: a treadmill's 0% to 12%, or a bike's
  // -10% to 20% (typical of a smart trainer), unless overridden
  inclineRange() {
    const treadmill = this.has("ftms-treadmill");
    return {
      min: this.inclineMin ?? (treadmill ? 0 : -10),
      max: this.inclineMax ?? (treadmill ? 12 : 20),
    };
  },
  init(services, options = {}) {
    this.services = services;
    this.inclineMin = options.inclineMin ?? null;
    this.inclineMax = options.inclineMax ?? null;
  }
};

module.exports = config;
