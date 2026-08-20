import { useCelestialPrefs } from "../hooks/useCelestialPrefs";
import {
  moonGlowTintForStatus,
  randomizeCelestialPrefs,
  SKINS,
  STATUS_KEYS,
  skinById,
  SUNS,
  sunById,
  type SkinId,
  type SunId,
} from "../lib/celestialPrefs";
import NovaStar from "./NovaStar";

/**
 * Observatory panel for the look of the system: which body each column flies,
 * and what colour finished subtasks burn. Changing a planet here retints the
 * column title and swaps the sprite orbiting in the galaxy -- one choice, both
 * places, because they are meant to be the same object.
 */
const CelestialPanel = () => {
  const [prefs, setPrefs] = useCelestialPrefs();

  const setSkin = (status: (typeof STATUS_KEYS)[number], skin: SkinId) => {
    setPrefs({ ...prefs, statusSkins: { ...prefs.statusSkins, [status]: skin } });
  };

  return (
    <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
      <div className="flex items-start justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
          Celestial bodies
        </p>
        <button
          type="button"
          onClick={() => setPrefs(randomizeCelestialPrefs())}
          className="shrink-0 rounded-lg border border-white/15 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-slate-300 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
        >
          Randomize
        </button>
      </div>
      <p className="mt-1.5 text-xs text-slate-500">
        Each column flies a body. Its colour carries to the board title and the
        galaxy alike.
      </p>

      <div className="mt-4 space-y-4">
        {STATUS_KEYS.map((status) => {
          const active = skinById(prefs.statusSkins[status]);
          return (
            <div key={status}>
              <div className="flex items-baseline justify-between gap-3">
                <span
                  className="font-mono text-[11px] font-semibold uppercase tracking-[0.14em]"
                  style={{ color: active.accent }}
                >
                  {status}
                </span>
                <span className="text-[10px] uppercase tracking-wide text-slate-500">
                  {active.label}
                </span>
              </div>
              <div
                role="group"
                aria-label={`Body for ${status}`}
                className="mt-2 flex flex-wrap gap-1.5"
              >
                {SKINS.map((skin) => {
                  const selected = skin.id === active.id;
                  return (
                    <button
                      key={skin.id}
                      type="button"
                      title={skin.label}
                      aria-label={`${skin.label} for ${status}`}
                      aria-pressed={selected}
                      onClick={() => setSkin(status, skin.id)}
                      className={[
                        "h-6 w-6 rounded-full border transition",
                        selected
                          ? "border-white/80 ring-2 ring-white/30"
                          : "border-white/15 hover:border-white/50",
                      ].join(" ")}
                      style={{ backgroundColor: skin.accent }}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-start justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            Moons
          </p>
          <button
            type="button"
            aria-pressed={prefs.moonGlow}
            onClick={() => setPrefs({ ...prefs, moonGlow: !prefs.moonGlow })}
            className={[
              "shrink-0 rounded-lg border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide transition",
              prefs.moonGlow
                ? "border-amber-300/70 bg-amber-400/15 text-amber-100"
                : "border-white/15 text-slate-400 hover:bg-white/10",
            ].join(" ")}
          >
            {prefs.moonGlow ? "Glow on" : "Glow off"}
          </button>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          What a subtask is made of, and what it burns. The body and its glow
          are separate colours; the glow can be switched off for flat bodies.
        </p>
        <div className="mt-3 grid grid-cols-3 gap-2">
          {STATUS_KEYS.map((status) => {
            const glow = moonGlowTintForStatus(prefs, status);
            return (
              <div key={status} className="flex flex-col gap-1.5">
                <span className="font-mono text-[9.5px] uppercase tracking-[0.1em] text-slate-400">
                  {status}
                </span>
                <span className="flex items-center gap-1.5">
                  <input
                    type="color"
                    aria-label={`Moon colour for ${status}`}
                    title="Body"
                    value={expandHex(prefs.moonTints[status])}
                    onChange={(event) =>
                      setPrefs({
                        ...prefs,
                        moonTints: { ...prefs.moonTints, [status]: event.target.value },
                      })
                    }
                    className="h-7 w-9 cursor-pointer rounded-lg border border-white/15 bg-transparent [color-scheme:dark]"
                  />
                  <input
                    type="color"
                    aria-label={`Moon glow for ${status}`}
                    title="Glow"
                    value={expandHex(glow)}
                    onChange={(event) =>
                      setPrefs({
                        ...prefs,
                        moonGlowTints: {
                          ...prefs.moonGlowTints,
                          [status]: event.target.value,
                        },
                      })
                    }
                    className="h-7 w-7 cursor-pointer rounded-full border border-white/15 bg-transparent [color-scheme:dark]"
                  />
                  <span
                    aria-hidden="true"
                    className="h-3 w-3 rounded-full"
                    style={{
                      backgroundColor: prefs.moonTints[status],
                      boxShadow: prefs.moonGlow ? `0 0 7px ${glow}` : "none",
                    }}
                  />
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-baseline justify-between gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
            The sun
          </p>
          <span className="text-[10px] uppercase tracking-wide text-slate-500">
            {sunById(prefs.sun).label}
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          What burns at the centre in Helios.
        </p>
        <div role="group" aria-label="Sun" className="mt-2 flex flex-wrap gap-1.5">
          {SUNS.map((sun) => {
            const selected = sun.id === prefs.sun;
            return (
              <button
                key={sun.id}
                type="button"
                title={sun.label}
                aria-label={sun.label}
                aria-pressed={selected}
                onClick={() => setPrefs({ ...prefs, sun: sun.id as SunId })}
                className={[
                  "h-6 w-6 rounded-full border transition",
                  selected
                    ? "border-white/80 ring-2 ring-white/30"
                    : "border-white/15 hover:border-white/50",
                ].join(" ")}
                style={{
                  background: `radial-gradient(circle at 35% 35%, #ffffff 0%, ${sun.glow} 55%, ${sun.glow}00 100%), ${sun.glow}`,
                }}
              />
            );
          })}
        </div>
      </div>

      <div className="mt-5 border-t border-white/10 pt-4">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-300">
              Subtask stars
            </p>
            <p className="mt-1 text-xs text-slate-500">
              What a finished subtask burns on the chip.
            </p>
          </div>
          <span className="inline-flex items-center gap-0.5">
            <NovaStar filled size={16} />
            <NovaStar filled size={16} />
            <NovaStar filled={false} size={16} />
          </span>
        </div>
        <div className="mt-3 flex items-center gap-2">
          <input
            type="color"
            aria-label="Subtask star colour"
            value={expandHex(prefs.starColor)}
            onChange={(event) => setPrefs({ ...prefs, starColor: event.target.value })}
            className="h-8 w-12 cursor-pointer rounded-lg border border-white/15 bg-transparent [color-scheme:dark]"
          />
          <span className="font-mono text-[11px] uppercase text-slate-400">
            {prefs.starColor}
          </span>
        </div>
      </div>
    </section>
  );
};

/** <input type="color"> rejects shorthand hex, so widen #abc before handing it over. */
const expandHex = (hex: string): string => {
  if (hex.length !== 4) return hex;
  return `#${hex
    .slice(1)
    .split("")
    .map((c) => c + c)
    .join("")}`;
};

export default CelestialPanel;
