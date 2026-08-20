import { useCallback, useEffect, useRef, useState } from "react";
import { pickNextTrack } from "../lib/shuffle";

/**
 * A small ambient player. One track at a time, created lazily so the app
 * never fetches audio the user didn't ask for. Picking a track replays it
 * on loop; shuffle mode lets the songs keep going, hopping to a different
 * track whenever one ends.
 */
export const useAmbientAudio = (tracks: string[]) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const srcRef = useRef<string | null>(null);
  const shuffleRef = useRef(false);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const onEndedRef = useRef<() => void>(() => {});
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);
  const [shuffle, setShuffle] = useState(false);

  const playSrc = useCallback((src: string) => {
    if (audioRef.current && srcRef.current !== src) {
      audioRef.current.pause();
      audioRef.current = null;
    }
    if (!audioRef.current) {
      const next = new Audio(src);
      next.addEventListener("ended", () => onEndedRef.current());
      audioRef.current = next;
      srcRef.current = src;
    }
    audioRef.current.loop = !shuffleRef.current;
    void audioRef.current.play().then(
      () => setPlayingSrc(src),
      () => setPlayingSrc(null)
    );
  }, []);

  onEndedRef.current = () => {
    if (!shuffleRef.current) return;
    const next = pickNextTrack(tracksRef.current, srcRef.current, Math.random());
    if (next) playSrc(next);
  };

  const toggle = useCallback(
    (src: string) => {
      const audio = audioRef.current;
      if (audio && srcRef.current === src && !audio.paused) {
        audio.pause();
        setPlayingSrc(null);
        return;
      }
      playSrc(src);
    },
    [playSrc]
  );

  const toggleShuffle = useCallback(() => {
    const next = !shuffleRef.current;
    shuffleRef.current = next;
    setShuffle(next);
    const audio = audioRef.current;
    if (audio) audio.loop = !next;
    if (next && (!audio || audio.paused)) {
      const pick = pickNextTrack(tracksRef.current, null, Math.random());
      if (pick) playSrc(pick);
    }
  }, [playSrc]);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return { playingSrc, shuffle, toggle, toggleShuffle };
};
