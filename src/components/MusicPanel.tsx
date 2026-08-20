import React from "react";

export interface MusicTrack {
  id: string;
  label: string;
  src: string;
}

interface MusicPanelProps {
  tracks: MusicTrack[];
  playingSrc: string | null;
  shuffle: boolean;
  onToggle: (src: string) => void;
  onToggleShuffle: () => void;
}

const PlayIcon: React.FC = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden="true">
    <path d="M2.5 1.5 10.5 6 2.5 10.5Z" />
  </svg>
);

const StopIcon: React.FC = () => (
  <svg viewBox="0 0 12 12" className="h-3 w-3 fill-current" aria-hidden="true">
    <rect x="2" y="2" width="8" height="8" rx="1.5" />
  </svg>
);

const ShuffleIcon: React.FC = () => (
  <svg
    viewBox="0 0 16 16"
    className="h-3.5 w-3.5 fill-none stroke-current"
    strokeWidth="1.5"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M1.5 4.5h3l6 7h3.5" />
    <path d="M1.5 11.5h3l6-7h3.5" />
    <path d="M12 2.5l2 2-2 2" />
    <path d="M12 9.5l2 2-2 2" />
  </svg>
);

/**
 * A little song mixer in the Observatory. Picking a track replays it on
 * loop; shuffle just keeps the songs going. The board never plays anything
 * uninvited.
 */
const MusicPanel: React.FC<MusicPanelProps> = ({
  tracks,
  playingSrc,
  shuffle,
  onToggle,
  onToggleShuffle,
}) => (
  <section className="mt-6 rounded-2xl border border-white/10 bg-white/5 p-4">
    <div className="flex items-center justify-between">
      <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-slate-400">
        Music
      </p>
      <button
        type="button"
        onClick={onToggleShuffle}
        aria-pressed={shuffle}
        aria-label={shuffle ? "Stop shuffling" : "Shuffle all tracks"}
        className={[
          "flex items-center gap-1.5 rounded-lg border px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide transition",
          shuffle
            ? "border-[#7c83ff]/60 bg-[#5b5cf0]/15 text-[#a5afff] shadow-[0_0_16px_rgba(124,131,255,0.25)]"
            : "border-white/10 text-slate-400 hover:border-white/30 hover:bg-white/5 hover:text-slate-200",
        ].join(" ")}
      >
        <ShuffleIcon />
        Shuffle
      </button>
    </div>
    <p className="mt-1.5 text-xs text-slate-500">
      Pick a song to loop it, or shuffle to let them play.
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
              aria-label={isPlaying ? `Stop ${track.label}` : `Play ${track.label}`}
              className={[
                "flex w-full items-center gap-3 rounded-xl border px-4 py-2.5 text-left transition",
                isPlaying
                  ? "border-[#7c83ff]/60 bg-[#5b5cf0]/15 shadow-[0_0_20px_rgba(124,131,255,0.25)]"
                  : "border-white/10 hover:border-white/30 hover:bg-white/5",
              ].join(" ")}
            >
              <span
                className={[
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border",
                  isPlaying
                    ? "border-[#7c83ff]/60 text-[#a5afff]"
                    : "border-white/15 text-slate-300",
                ].join(" ")}
              >
                {isPlaying ? <StopIcon /> : <PlayIcon />}
              </span>
              <span
                className={[
                  "flex-1 text-sm",
                  isPlaying ? "text-[#c9d0ff]" : "text-slate-200",
                ].join(" ")}
              >
                {track.label}
              </span>
              {isPlaying ? (
                <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide text-[#a5afff]">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-[#a5afff]" />
                  {shuffle ? "Mixing" : "Looping"}
                </span>
              ) : null}
            </button>
          </li>
        );
      })}
    </ul>
  </section>
);

export default MusicPanel;
