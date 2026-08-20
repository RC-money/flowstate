import { useCallback, useEffect, useRef } from "react";
import { noteToFrequency } from "../lib/notes";

/**
 * A soft synth for the Observatory piano. The AudioContext is created on
 * the first keypress -- a user gesture -- so autoplay policies stay happy
 * and silence costs nothing.
 */
export const usePianoSynth = () => {
  const contextRef = useRef<AudioContext | null>(null);

  const playNote = useCallback((note: string) => {
    if (!contextRef.current) contextRef.current = new AudioContext();
    const context = contextRef.current;
    if (context.state === "suspended") void context.resume();

    const now = context.currentTime;
    const osc = context.createOscillator();
    const gain = context.createGain();
    osc.type = "triangle";
    osc.frequency.value = noteToFrequency(note);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.25, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.2);
    osc.connect(gain);
    gain.connect(context.destination);
    osc.start(now);
    osc.stop(now + 1.3);
  }, []);

  useEffect(() => {
    return () => {
      void contextRef.current?.close();
      contextRef.current = null;
    };
  }, []);

  return playNote;
};
