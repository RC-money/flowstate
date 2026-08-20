import React, { useMemo } from "react";
import { keyRange } from "../lib/notes";

interface PianoStripProps {
  melody: string[];
  onPlay: (note: string) => void;
}

/**
 * A one-octave piano stretched across its container. Keys carrying the
 * track's melody wear a small glowing dot, so the song can be picked out
 * by following the lights.
 */
const PianoStrip: React.FC<PianoStripProps> = ({ melody, onPlay }) => {
  const keys = useMemo(() => keyRange("G4", "G5"), []);
  const melodyNotes = useMemo(() => new Set(melody), [melody]);
  const whites = keys.filter((key) => !key.isBlack);

  return (
    <div className="relative flex h-16 w-full select-none overflow-hidden rounded-lg border border-white/10">
      {whites.map((white, index) => {
        const black = keys.find(
          (key) => key.isBlack && key.note === `${white.note[0]}#${white.note.slice(-1)}`
        );
        return (
          <div key={white.note} className="relative flex-1">
            <button
              type="button"
              onClick={() => onPlay(white.note)}
              aria-label={`Play ${white.note}`}
              className={[
                "flex h-full w-full items-end justify-center pb-1.5 transition active:bg-[#a5afff]/40",
                "bg-slate-200/90 hover:bg-white",
                index > 0 ? "border-l border-slate-400/40" : "",
              ].join(" ")}
            >
              {melodyNotes.has(white.note) ? (
                <span className="h-1.5 w-1.5 rounded-full bg-[#5b5cf0] shadow-[0_0_6px_rgba(124,131,255,0.9)]" />
              ) : null}
            </button>
            {black ? (
              <button
                type="button"
                onClick={() => onPlay(black.note)}
                aria-label={`Play ${black.note}`}
                className="absolute -right-[15%] top-0 z-10 flex h-[58%] w-[30%] items-end justify-center rounded-b-[3px] bg-[#090a19] pb-1 shadow-[0_2px_6px_rgba(0,0,0,0.6)] transition hover:bg-[#12142b] active:bg-[#3a33b5]"
              >
                {melodyNotes.has(black.note) ? (
                  <span className="h-1 w-1 rounded-full bg-[#a5afff] shadow-[0_0_5px_rgba(124,131,255,0.9)]" />
                ) : null}
              </button>
            ) : null}
          </div>
        );
      })}
    </div>
  );
};

export default PianoStrip;
