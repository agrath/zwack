class Flags {
  constructor(flagNames) {
    if (!flagNames || !Array.isArray(flagNames)) {
      throw new Error("flag names must be an array");
    }
    this.flagNames = flagNames;
    this.flagEnum = {};
    for (let i = 0; i < flagNames.length; i++) {
      this.flagEnum[flagNames[i]] = 2 * i;
    }

    this.flags = 0;
  }

  from(event) {
    this.reset();
    let bitmask = 0;
    this.flagNames.forEach((key, index) => {
      if (event.hasOwnProperty(key)) {
        // Set the bit at position `index` to 1
        bitmask |= 1 << index;
      }
    });
    this.flags = bitmask;
    return this.flags;
  }

  reset() {
    this.flags = 0;
  }

  isSet(flagName) {
    // Find the index of the key in the keys array
    const index = this.flagNames.indexOf(flagName);

    if (index === -1) {
        throw new Error(`Key "${key}" not found in the keys array.`);
    }

    // Check if the bit at the corresponding index is set
    return (this.flags & (1 << index)) !== 0;
  }

  set(flagName) {
    if (this.flagEnum && this.flagEnum.hasOwnProperty(flagName)) {
      this.flags = this.flags | this.flagEnum[flagName];
    }
    return this.flags;
  }
}

module.exports = Flags;
