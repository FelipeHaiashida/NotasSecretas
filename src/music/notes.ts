/**
 * Módulo de Teoria Musical e Temperamento Igual
 *
 * Implementa a relação matemática entre notas musicais e frequências sonoras
 * utilizando o sistema de temperamento igual com referência Lá4 (A4) = 440 Hz.
 *
 * Equações fundamentais:
 *   f(m) = 440 * 2^((m - 69) / 12)
 *   m(f) = 69 + 12 * log2(f / 440)
 *   Erro_cents = 1200 * log2(f_detectada / f_teorica)
 */

export const A4_FREQUENCY = 440.0;
export const A4_MIDI = 69;

/**
 * Nomes das 12 notas cromáticas na nomenclatura brasileira.
 */
export const CHROMATIC_NOTE_NAMES = [
  'Dó',
  'Dó♯',
  'Ré',
  'Ré♯',
  'Mi',
  'Fá',
  'Fá♯',
  'Sol',
  'Sol♯',
  'Lá',
  'Lá♯',
  'Si',
] as const;

export type ChromaticNoteName = (typeof CHROMATIC_NOTE_NAMES)[number];

/**
 * Índices semitonais (dentro de uma oitava, 0 a 11) das 7 notas naturais (teclas brancas).
 */
export const NATURAL_SEMITONE_INDICES = [0, 2, 4, 5, 7, 9, 11] as const;

export interface MusicalNote {
  /** Número MIDI inteiro (ex.: 60 = Dó4, 69 = Lá4) */
  midi: number;
  /** Nome da nota sem oitava (ex.: "Lá", "Dó♯") */
  name: ChromaticNoteName;
  /** Oitava no padrão científico (ex.: 4) */
  octave: number;
  /** Nome completo formatado (ex.: "Lá4", "Dó♯4") */
  fullName: string;
  /** Frequência teórica exata calculada por f(m) = 440 * 2^((m - 69)/12) */
  frequency: number;
  /** Indica se é nota alterada (sustenido) */
  isSharp: boolean;
}

export interface DetectedNoteResult {
  /** Nota temperada mais próxima */
  note: MusicalNote;
  /** Número MIDI fracionário exato antes do arredondamento */
  exactMidi: number;
  /** Frequência detectada usada na conversão (Hz) */
  detectedFrequency: number;
  /** Erro absoluto |f_detectada - f_nota_mais_proxima| em Hz */
  absoluteErrorHz: number;
  /** Desvio em cents em relação à nota mais próxima: 1200 * log2(f_detectada / f_nota) */
  centsDeviation: number;
}

/**
 * Converte um número MIDI em frequência (Hz) pelo temperamento igual:
 * f(m) = 440 * 2^((m - 69) / 12)
 */
export function midiToFrequency(midi: number): number {
  if (!Number.isFinite(midi)) {
    throw new Error('O número MIDI deve ser um valor finito.');
  }
  return A4_FREQUENCY * Math.pow(2, (midi - A4_MIDI) / 12);
}

/**
 * Converte uma frequência (Hz) em número MIDI contínuo (fracionário):
 * m(f) = 69 + 12 * log2(f / 440)
 */
export function frequencyToExactMidi(frequency: number): number {
  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new Error('A frequência deve ser um número positivo finito.');
  }
  return A4_MIDI + 12 * Math.log2(frequency / A4_FREQUENCY);
}

/**
 * Converte uma frequência (Hz) no número MIDI inteiro mais próximo.
 */
export function frequencyToNearestMidi(frequency: number): number {
  return Math.round(frequencyToExactMidi(frequency));
}

/**
 * Constrói os metadados completos de uma nota musical a partir do número MIDI inteiro.
 */
export function getNoteFromMidi(midi: number): MusicalNote {
  const roundedMidi = Math.round(midi);
  const semitone = ((roundedMidi % 12) + 12) % 12;
  const octave = Math.floor(roundedMidi / 12) - 1;
  const name = CHROMATIC_NOTE_NAMES[semitone];
  const isSharp = name.includes('♯');
  return {
    midi: roundedMidi,
    name,
    octave,
    fullName: `${name}${octave}`,
    frequency: midiToFrequency(roundedMidi),
    isSharp,
  };
}

/**
 * Calcula o erro absoluto em Hz entre frequência detectada e frequência teórica:
 * Erro_abs = |f_detectada - f_teorica|
 */
export function calculateAbsoluteErrorHz(detectedFreq: number, theoreticalFreq: number): number {
  return Math.abs(detectedFreq - theoreticalFreq);
}

/**
 * Calcula o erro em cents entre a frequência detectada e a frequência teórica:
 * Erro_cents = 1200 * log2(f_detectada / f_teorica)
 */
export function calculateCentsError(detectedFreq: number, theoreticalFreq: number): number {
  if (detectedFreq <= 0 || theoreticalFreq <= 0) {
    throw new Error('As frequências devem ser maiores que zero para o cálculo em cents.');
  }
  return 1200 * Math.log2(detectedFreq / theoreticalFreq);
}

/**
 * Identifica a nota musical mais próxima a partir de uma frequência estimada em Hz.
 */
export function frequencyToMusicalNote(frequency: number): DetectedNoteResult {
  const exactMidi = frequencyToExactMidi(frequency);
  const nearestMidi = Math.round(exactMidi);
  const note = getNoteFromMidi(nearestMidi);
  const absoluteErrorHz = calculateAbsoluteErrorHz(frequency, note.frequency);
  const centsDeviation = calculateCentsError(frequency, note.frequency);

  return {
    note,
    exactMidi,
    detectedFrequency: frequency,
    absoluteErrorHz,
    centsDeviation,
  };
}

/**
 * Gera a lista de notas para o Modo Fácil (Aprendiz musical):
 * 7 notas naturais da 4ª oitava (Dó4 a Si4, MIDI 60 a 71 apenas naturais).
 */
export function getEasyModeNotes(): MusicalNote[] {
  const baseMidiC4 = 60;
  return NATURAL_SEMITONE_INDICES.map((offset) => getNoteFromMidi(baseMidiC4 + offset));
}

/**
 * Gera a lista de notas para o Modo Intermediário (Explorador de frequências):
 * 12 notas cromáticas da 4ª oitava (Dó4 a Si4, MIDI 60 a 71).
 */
export function getIntermediateModeNotes(): MusicalNote[] {
  const notes: MusicalNote[] = [];
  for (let midi = 60; midi <= 71; midi++) {
    notes.push(getNoteFromMidi(midi));
  }
  return notes;
}

/**
 * Gera a lista de notas para o Modo Difícil (Mestre da FFT):
 * Todas as 36 notas cromáticas entre Dó3 (MIDI 48) e Si5 (MIDI 83).
 */
export function getHardModeNotes(): MusicalNote[] {
  const notes: MusicalNote[] = [];
  for (let midi = 48; midi <= 83; midi++) {
    notes.push(getNoteFromMidi(midi));
  }
  return notes;
}
