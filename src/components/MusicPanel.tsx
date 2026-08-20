import React from "react";

export interface MusicTrack {
  id: string;
  label: string;
  src: string;
}

interface MusicPanelProps {
  tracks: MusicTrack[];
  playingSrc: string | null;
  onToggle: (src: string) => void;
}

/**
 * Ambient music lives in the Observatory with the other quiet panels.
 * One track at a time; the board never plays anything uninvited.
 */
const MusicPanel: React.FC<MusicPanelProps> = ({ tracks, playingSrc, onToggle }) => (
  <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
      Music
    </p>
    <p className="mt-1.5 text-xs text-slate-500">
      Optional ambience. Loops quietly until you stop it.
    </p>
    <ul className="mt-3 space-y-2">
      {tracks.map((track) => {
        const isPlaying = playingSrc === track.src;
        return (
          <li key={track.id}>
            <button
              type="button"
              onClick={() => onToggle(track.src)}
              aria-pressed={isPlaying}
              className={[
                "flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-left transition",
                isPlaying
                  ? "border-[#7c83ff]/60 bg-[#5b5cf0]/15 shadow-[0_0_20px_rgba(124,131,255,0.25)]"
                  : "border-white/10 hover:border-white/30 hover:bg-white/5",
              ].join(" ")}
            >
              <span
                className={[
                  "text-sm",
                  isPlaying ? "text-[#c9d0ff]" : "text-slate-200",
                ].join(" ")}
              >
                {track.label}
              </span>
              <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
                {isPlaying ? (
                  <>
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a5afff]" />
                    <span className="text-[#a5afff]">Playing</span>
                  </>
                ) : (
                  <span className="text-slate-400">Play</span>
                )}
              </span>
            </button>
          </li>
        );
      })}
    </ul>
  </section>
);

export default MusicPanel;
