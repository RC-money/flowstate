import { describe, expect, it } from "vitest";
import {
  accentForStatus,
  DEFAULT_CELESTIAL_PREFS,
  moonTintForStatus,
  moonGlowTintForStatus,
  normalizeCelestialPrefs,
  randomizeCelestialPrefs,
  SKINS,
  skinById,
  SUNS,
  sunById,
  STATUS_KEYS,
} from "./celestialPrefs";

describe("SKINS", () => {
  it("offers seven bodies, one per moon sprite", () => {
    expect(SKINS).toHaveLength(7);
  });

  it("gives every skin a readable accent and a label", () => {
    for (const skin of SKINS) {
      expect(skin.accent).toMatch(/^#[0-9a-f]{6}$/i);
      expect(skin.label.length).toBeGreaterThan(0);
    }
  });

  it("has no duplicate ids and no duplicate colours", () => {
    expect(new Set(SKINS.map((s) => s.id)).size).toBe(SKINS.length);
    expect(new Set(SKINS.map((s) => s.accent.toLowerCase())).size).toBe(SKINS.length);
  });
});

describe("skinById", () => {
  it("finds a known skin", () => {
    expect(skinById("moon3").id).toBe("moon3");
  });

  it("falls back rather than returning undefined for junk", () => {
    expect(skinById("not-a-skin").id).toBe(SKINS[0].id);
  });
});

describe("normalizeCelestialPrefs", () => {
  it("returns defaults for missing input", () => {
    expect(normalizeCelestialPrefs(undefined)).toEqual(DEFAULT_CELESTIAL_PREFS);
    expect(normalizeCelestialPrefs(null)).toEqual(DEFAULT_CELESTIAL_PREFS);
  });

  it("repairs rather than rejects when one status is nonsense", () => {
    const result = normalizeCelestialPrefs({
      statusSkins: { "TO-DO": "moon5", "IN PROGRESS": "bogus", DONE: "moon2" },
      starColor: "#ff0000",
    });
    expect(result.statusSkins["TO-DO"]).toBe("moon5");
    expect(result.statusSkins["IN PROGRESS"]).toBe(
      DEFAULT_CELESTIAL_PREFS.statusSkins["IN PROGRESS"]
    );
    expect(result.statusSkins.DONE).toBe("moon2");
    expect(result.starColor).toBe("#ff0000");
  });

  it("rejects a malformed colour without discarding the skins", () => {
    const result = normalizeCelestialPrefs({
      statusSkins: { "TO-DO": "moon1", "IN PROGRESS": "moon2", DONE: "moon3" },
      starColor: "javascript:alert(1)",
    });
    expect(result.starColor).toBe(DEFAULT_CELESTIAL_PREFS.starColor);
    expect(result.statusSkins["TO-DO"]).toBe("moon1");
  });

  it("keeps a valid moon tint and repairs a broken one", () => {
    const result = normalizeCelestialPrefs({
      moonTints: { "TO-DO": "#123456", "IN PROGRESS": "nope", DONE: "#abc" },
    });
    expect(result.moonTints["TO-DO"]).toBe("#123456");
    expect(result.moonTints["IN PROGRESS"]).toBe(
      DEFAULT_CELESTIAL_PREFS.moonTints["IN PROGRESS"]
    );
    expect(result.moonTints.DONE).toBe("#abc");
  });

  it("survives a completely wrong shape", () => {
    expect(normalizeCelestialPrefs("nope")).toEqual(DEFAULT_CELESTIAL_PREFS);
    expect(normalizeCelestialPrefs({ statusSkins: 42, moonTints: 7 })).toEqual(
      DEFAULT_CELESTIAL_PREFS
    );
  });
});

describe("accentForStatus", () => {
  it("reads the accent off the chosen skin", () => {
    const prefs = normalizeCelestialPrefs({
      statusSkins: { "TO-DO": "moon0", "IN PROGRESS": "moon6", DONE: "moon2" },
    });
    expect(accentForStatus(prefs, "TO-DO")).toBe(skinById("moon0").accent);
    expect(accentForStatus(prefs, "IN PROGRESS")).toBe(skinById("moon6").accent);
  });

  it("covers every status key", () => {
    for (const key of STATUS_KEYS) {
      expect(accentForStatus(DEFAULT_CELESTIAL_PREFS, key)).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });
});

describe("moonTintForStatus", () => {
  it("returns the per-column tint", () => {
    const prefs = normalizeCelestialPrefs({ moonTints: { "TO-DO": "#00ff00" } });
    expect(moonTintForStatus(prefs, "TO-DO")).toBe("#00ff00");
  });

  it("covers every status key by default", () => {
    for (const key of STATUS_KEYS) {
      expect(moonTintForStatus(DEFAULT_CELESTIAL_PREFS, key)).toMatch(/^#[0-9a-f]{3,6}$/i);
    }
  });
});

describe("moonGlowTintForStatus: the glow is its own colour", () => {
  it("falls back to the body's tint, so nothing changes until it is set", () => {
    const prefs = normalizeCelestialPrefs({ moonTints: { "TO-DO": "#00ff00" } });

    expect(moonGlowTintForStatus(prefs, "TO-DO")).toBe("#00ff00");
  });

  it("keeps a glow colour that differs from the body", () => {
    const prefs = normalizeCelestialPrefs({
      moonTints: { "TO-DO": "#00ff00" },
      moonGlowTints: { "TO-DO": "#ff00ff" },
    });

    expect(moonTintForStatus(prefs, "TO-DO")).toBe("#00ff00");
    expect(moonGlowTintForStatus(prefs, "TO-DO")).toBe("#ff00ff");
  });

  it("ignores a glow colour that is not a colour", () => {
    const prefs = normalizeCelestialPrefs({
      moonTints: { DONE: "#123456" },
      moonGlowTints: { DONE: "nope" },
    });

    expect(moonGlowTintForStatus(prefs, "DONE")).toBe("#123456");
  });

  it("survives a stored blob whose glow tints are not even an object", () => {
    const prefs = normalizeCelestialPrefs({ moonGlowTints: 42 });

    expect(moonGlowTintForStatus(prefs, "DONE")).toBe(
      DEFAULT_CELESTIAL_PREFS.moonTints.DONE
    );
  });
});

describe("randomizeCelestialPrefs", () => {
  const seeded = (values: number[]) => {
    let i = 0;
    return () => values[i++ % values.length];
  };

  it("produces prefs that survive normalization unchanged", () => {
    const prefs = randomizeCelestialPrefs(seeded([0.1, 0.5, 0.9, 0.3, 0.7]));
    expect(normalizeCelestialPrefs(prefs)).toEqual(prefs);
  });

  it("gives each column a different body so they stay tellable apart", () => {
    const prefs = randomizeCelestialPrefs(seeded([0.05, 0.44, 0.86, 0.2, 0.6]));
    const chosen = STATUS_KEYS.map((k) => prefs.statusSkins[k]);
    expect(new Set(chosen).size).toBe(STATUS_KEYS.length);
  });

  it("is deterministic for a given random source", () => {
    const a = randomizeCelestialPrefs(seeded([0.2, 0.4, 0.6, 0.8]));
    const b = randomizeCelestialPrefs(seeded([0.2, 0.4, 0.6, 0.8]));
    expect(a).toEqual(b);
  });

  it("never emits a malformed colour, even at the extremes", () => {
    for (const v of [0, 0.999999, 0.5]) {
      const prefs = randomizeCelestialPrefs(() => v);
      expect(prefs.starColor).toMatch(/^#[0-9a-f]{6}$/i);
      for (const key of STATUS_KEYS) {
        expect(prefs.moonTints[key]).toMatch(/^#[0-9a-f]{6}$/i);
      }
    }
  });
});

describe("SUNS", () => {
  it("offers a spread of stars", () => {
    expect(SUNS.length).toBeGreaterThan(4);
  });

  it("leads with Sol, which stays the default", () => {
    expect(SUNS[0].id).toBe("sol");
    expect(DEFAULT_CELESTIAL_PREFS.sun).toBe("sol");
  });

  it("gives every star a label and a glow that reads on black", () => {
    for (const sun of SUNS) {
      expect(sun.label.length).toBeGreaterThan(0);
      expect(sun.glow).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it("has no duplicate ids", () => {
    expect(new Set(SUNS.map((s) => s.id)).size).toBe(SUNS.length);
  });
});

describe("sunById", () => {
  it("finds a known star", () => {
    expect(sunById("sapphire").id).toBe("sapphire");
  });

  it("falls back to Sol rather than returning undefined", () => {
    expect(sunById("not-a-star").id).toBe("sol");
  });
});

describe("normalizeCelestialPrefs with a sun", () => {
  it("keeps a known star", () => {
    expect(normalizeCelestialPrefs({ sun: "frost" }).sun).toBe("frost");
  });

  it("repairs an unknown star back to Sol", () => {
    expect(normalizeCelestialPrefs({ sun: "banana" }).sun).toBe("sol");
    expect(normalizeCelestialPrefs({ sun: 42 }).sun).toBe("sol");
  });

  it("does not lose the star when another field is broken", () => {
    const result = normalizeCelestialPrefs({ sun: "cinder", starColor: "nope" });
    expect(result.sun).toBe("cinder");
    expect(result.starColor).toBe(DEFAULT_CELESTIAL_PREFS.starColor);
  });
});

describe("moonGlow toggle", () => {
  it("is on by default", () => {
    expect(DEFAULT_CELESTIAL_PREFS.moonGlow).toBe(true);
  });

  it("keeps an explicit false", () => {
    expect(normalizeCelestialPrefs({ moonGlow: false }).moonGlow).toBe(false);
  });

  it("keeps an explicit true", () => {
    expect(normalizeCelestialPrefs({ moonGlow: true }).moonGlow).toBe(true);
  });

  it("repairs a non-boolean back to on", () => {
    expect(normalizeCelestialPrefs({ moonGlow: "yes" }).moonGlow).toBe(true);
    expect(normalizeCelestialPrefs({ moonGlow: 0 }).moonGlow).toBe(true);
  });

  it("does not lose the toggle when another field is broken", () => {
    const result = normalizeCelestialPrefs({ moonGlow: false, sun: "banana" });
    expect(result.moonGlow).toBe(false);
    expect(result.sun).toBe("sol");
  });
});
