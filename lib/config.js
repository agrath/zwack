// Centralised configuration parsed from command line arguments.
// Set by the simulator entry point, consumed by service/characteristic modules.

const config = {
  services: [],
  has(service) {
    return this.services.includes(service);
  },
  init(services) {
    this.services = services;
  }
};

module.exports = config;
