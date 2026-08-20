import { useCallback, useEffect, useRef, useState } from "react";

/**
 * One looping ambient track at a time. Audio is created lazily on first
 * play so the app never fetches a track the user didn't ask for, and
 * starting a different track stops the current one.
 */
export const useAmbientAudio = () => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const srcRef = useRef<string | null>(null);
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);

  const toggle = useCallback((src: string) => {
    const audio = audioRef.current;
    if (audio && srcRef.current === src && !audio.paused) {
      audio.pause();
      setPlayingSrc(null);
      return;
    }
    if (audio && srcRef.current !== src) {
      audio.pause();
      audioRef.current = null;
    }
    if (!audioRef.current) {
      const next = new Audio(src);
      next.loop = true;
      audioRef.current = next;
      srcRef.current = src;
    }
    void audioRef.current.play().then(
      () => setPlayingSrc(src),
      () => setPlayingSrc(null)
    );
  }, []);

  useEffect(() => {
    return () => {
      audioRef.current?.pause();
      audioRef.current = null;
    };
  }, []);

  return { playingSrc, toggle };
};
