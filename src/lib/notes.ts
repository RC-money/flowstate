/**
 * Note math for the little piano. Names are scientific pitch ("C#5"),
 * tuned to equal temperament around A4 = 440.
 */
const NOTE_NAMES = [
  "C",
  "C#",
  "D",
  "D#",
  "E",
  "F",
  "F#",
  "G",
  "G#",
  "A",
  "A#",
  "B",
] as const;

export interface PianoKey {
  note: string;
  isBlack: boolean;
}

const noteToMidi = (note: string): number => {
  const match = /^([A-G]#?)(\d)$/.exec(note);
  if (!match) throw new Error(`Unparseable note: ${note}`);
  const [, name, octave] = match;
  return (Number(octave) + 1) * 12 + NOTE_NAMES.indexOf(name as (typeof NOTE_NAMES)[number]);
};

const midiToNote = (midi: number): PianoKey => {
  const name = NOTE_NAMES[midi % 12];
  const octave = Math.floor(midi / 12) - 1;
  return { note: `${name}${octave}`, isBlack: name.includes("#") };
};

export const noteToFrequency = (note: string): number =>
  440 * 2 ** ((noteToMidi(note) - noteToMidi("A4")) / 12);

export const keyRange = (start: string, end: string): PianoKey[] => {
  const from = noteToMidi(start);
  const to = noteToMidi(end);
  const keys: PianoKey[] = [];
  for (let midi = from; midi <= to; midi += 1) keys.push(midiToNote(midi));
  return keys;
};
