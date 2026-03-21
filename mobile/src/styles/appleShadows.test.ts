import { appleCardShadowResting, appleCardShadowProminent, appleTileShadow } from "./appleShadows";

describe("appleShadows", () => {
  it("resting shadow uses layered-style iOS keys (mock OS=ios)", () => {
    const light = appleCardShadowResting(false);
    expect(light).toMatchObject({
      shadowColor: "#000",
      shadowOffset: { width: 0, height: 2 },
    });
    expect(typeof (light as any).shadowOpacity).toBe("number");
    expect(typeof (light as any).shadowRadius).toBe("number");
  });

  it("prominent shadow is stronger than resting for light mode", () => {
    const r = appleCardShadowResting(false) as any;
    const p = appleCardShadowProminent(false) as any;
    expect(p.shadowRadius).toBeGreaterThanOrEqual(r.shadowRadius);
    expect(p.shadowOffset.height).toBeGreaterThanOrEqual(r.shadowOffset.height);
  });

  it("tile shadow exports consistent structure", () => {
    const t = appleTileShadow(true) as any;
    expect(t.shadowColor).toBe("#000");
  });
});
