const { TestEnvironment } = require("jest-environment-node");

class CustomEnvironment extends TestEnvironment {
  constructor(config, context) {
    super(config, context);
    const store = {};
    const ls = {
      getItem: (k) => store[k] ?? null,
      setItem: (k, v) => { store[k] = String(v); },
      removeItem: (k) => { delete store[k]; },
      clear: () => { for (const k in store) delete store[k]; },
      length: 0,
      key: () => null,
    };
    // Override the getter in jest-environment-node that throws SecurityError
    for (const prop of ["localStorage", "sessionStorage"]) {
      Object.defineProperty(this.global, prop, {
        value: ls,
        writable: true,
        configurable: true,
      });
    }
  }
}

module.exports = CustomEnvironment;
