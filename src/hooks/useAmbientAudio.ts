import { useCallback, useEffect, useRef, useState } from "react";
import { pickNextTrack } from "../lib/shuffle";
import { detectSwell, initialSwellState, type SwellState } from "../lib/swell";

export const METEOR_SHOWER_EVENT = "flowstate:meteor-shower";

/**
 * A small ambient player. One track at a time, created lazily so the app
 * never fetches audio the user didn't ask for. Picking a track replays it
 * on loop; shuffle mode lets the songs keep going, hopping to a different
 * track whenever one ends.
 *
 * While a track plays, an analyser watches the signal for emotional
 * swells -- passages noticeably louder than the track's own baseline --
 * and announces each one as a meteor-shower event. Silence never fires.
 */
export const useAmbientAudio = (tracks: string[]) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const srcRef = useRef<string | null>(null);
  const shuffleRef = useRef(false);
  const tracksRef = useRef(tracks);
  tracksRef.current = tracks;
  const onEndedRef = useRef<() => void>(() => {});
  const contextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const monitorRef = useRef<number | null>(null);
  const swellRef = useRef<SwellState>(initialSwellState());
  const lastSampleRef = useRef(0);
  const [playingSrc, setPlayingSrc] = useState<string | null>(null);
  const [shuffle, setShuffle] = useState(false);

  const stopMonitor = useCallback(() => {
    if (monitorRef.current !== null) {
      cancelAnimationFrame(monitorRef.current);
      monitorRef.current = null;
    }
  }, []);

  const startMonitor = useCallback(() => {
    const analyser = analyserRef.current;
    if (!analyser || monitorRef.current !== null) return;
    const samples = new Uint8Array(analyser.fftSize);
    const step = (now: number) => {
      const audio = audioRef.current;
      if (!audio || audio.paused) {
        monitorRef.current = null;
        return;
      }
      if (now - lastSampleRef.current >= 100) {
        lastSampleRef.current = now;
        analyser.getByteTimeDomainData(samples);
        let sum = 0;
        for (let i = 0; i < samples.length; i += 1) {
          const centered = (samples[i] - 128) / 128;
          sum += centered * centered;
        }
        const rms = Math.sqrt(sum / samples.length);
        const result = detectSwell(swellRef.current, rms, now);
        swellRef.current = result.state;
        if (result.swell) {
          window.dispatchEvent(new CustomEvent(METEOR_SHOWER_EVENT));
        }
      }
      monitorRef.current = requestAnimationFrame(step);
    };
    monitorRef.current = requestAnimationFrame(step);
  }, []);

  const playSrc = useCallback(
    (src: string) => {
      if (audioRef.current && srcRef.current !== src) {
        audioRef.current.pause();
        audioRef.current = null;
        analyserRef.current?.disconnect();
        analyserRef.current = null;
      }
      if (!audioRef.current) {
        const next = new Audio(src);
        next.addEventListener("ended", () => onEndedRef.current());
        audioRef.current = next;
        srcRef.current = src;
        swellRef.current = initialSwellState();
        if (!contextRef.current) contextRef.current = new AudioContext();
        const context = contextRef.current;
        const analyser = context.createAnalyser();
        analyser.fftSize = 1024;
        context.createMediaElementSource(next).connect(analyser);
        analyser.connect(context.destination);
        analyserRef.current = analyser;
      }
      if (contextRef.current?.state === "suspended") {
        void contextRef.current.resume();
      }
      audioRef.current.loop = !shuffleRef.current;
      void audioRef.current.play().then(
        () => {
          setPlayingSrc(src);
          startMonitor();
        },
        () => setPlayingSrc(null)
      );
    },
    [startMonitor]
  );

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
        stopMonitor();
        setPlayingSrc(null);
        return;
      }
      playSrc(src);
    },
    [playSrc, stopMonitor]
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
      stopMonitor();
      audioRef.current?.pause();
      audioRef.current = null;
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, [stopMonitor]);

  return { playingSrc, shuffle, toggle, toggleShuffle };
};
