/** Minimal RN mock for node tests (Platform only). */
module.exports = {
  Platform: {
    OS: "ios",
    select: (spec) => spec.ios,
  },
  StyleSheet: {
    create: (styles) => styles,
    absoluteFillObject: { position: "absolute", left: 0, right: 0, top: 0, bottom: 0 },
  },
};
