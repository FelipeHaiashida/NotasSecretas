/**
 * Módulo de Lógica de Jogo (Nota Secreta)
 *
 * Gerencia modos de dificuldade, sorteio sem repetição consecutiva,
 * geração de dicas matemáticas verdadeiras baseadas na nota real,
 * validação de respostas, explicações educativas dinâmicas e estado das 10 rodadas.
 */

import { TimbreType } from '../audio/synthesizer';
import { PitchDetectionResult } from '../dsp/pitchDetection';
import { getWindowMetadata, WindowType } from '../dsp/windows';
import {
  getEasyModeNotes,
  getHardModeNotes,
  getIntermediateModeNotes,
  MusicalNote,
} from '../music/notes';
import {
  calculateRoundScore,
  TOTAL_ROUNDS_PER_MATCH,
} from './scoring';

export type DifficultyLevel = 'easy' | 'intermediate' | 'hard';

export interface DifficultyConfig {
  id: DifficultyLevel;
  title: string;
  subtitle: string;
  description: string;
  rangeDescription: string;
}

export const DIFFICULTY_CONFIGS: Record<DifficultyLevel, DifficultyConfig> = {
  easy: {
    id: 'easy',
    title: 'Modo Fácil — Aprendiz Musical',
    subtitle: '7 notas naturais (Dó4 a Si4)',
    description:
      'Apenas as sete notas naturais da quarta oitava, sem sustenidos. Ideal para compreender a relação direta entre frequência fundamental e escala diatônica.',
    rangeDescription: '261,63 Hz (Dó4) a 493,88 Hz (Si4)',
  },
  intermediate: {
    id: 'intermediate',
    title: 'Modo Intermediário — Explorador de Frequências',
    subtitle: '12 notas cromáticas (Dó4 a Si4)',
    description:
      'Todas as doze notas cromáticas da quarta oitava, incluindo sustenidos, em um teclado virtual de piano de uma oitava.',
    rangeDescription: '261,63 Hz (Dó4) a 493,88 Hz (Si4) — Escala Cromática',
  },
  hard: {
    id: 'hard',
    title: 'Modo Difícil — Mestre da FFT',
    subtitle: '36 notas cromáticas (Dó3 a Si5)',
    description:
      'Três oitavas completas! Identifique tanto a nota cromática quanto a oitava correta analisando timbres graves, médios e agudos.',
    rangeDescription: '130,81 Hz (Dó3) a 987,77 Hz (Si5)',
  },
};

export interface RoundHistoryItem {
  roundNumber: number;
  targetNote: MusicalNote;
  selectedNote: MusicalNote;
  isCorrect: boolean;
  usedHint: boolean;
  pointsEarned: number;
  detectedFrequency: number;
  theoreticalFrequency: number;
  errorHz: number;
  errorCents: number;
  dominantBin: number;
  windowType: WindowType;
  timbre: TimbreType;
  educationalExplanation: string;
}

export interface MatchState {
  difficulty: DifficultyLevel;
  currentRound: number;
  totalRounds: number;
  score: number;
  targetNote: MusicalNote;
  availableNotes: MusicalNote[];
  usedHintInCurrentRound: boolean;
  currentHintText: string | null;
  roundAnswered: boolean;
  matchFinished: boolean;
  history: RoundHistoryItem[];
}

/**
 * Retorna a lista de notas disponíveis para o nível de dificuldade selecionado.
 */
export function getNotesForDifficulty(difficulty: DifficultyLevel): MusicalNote[] {
  switch (difficulty) {
    case 'easy':
      return getEasyModeNotes();
    case 'intermediate':
      return getIntermediateModeNotes();
    case 'hard':
      return getHardModeNotes();
  }
}

/**
 * Sorteia aleatoriamente uma nota do conjunto disponível, garantindo que não haja
 * repetição da mesma nota (mesmo código MIDI) em rodadas consecutivas.
 */
export function pickRandomNote(
  availableNotes: ReadonlyArray<MusicalNote>,
  previousNoteMidi?: number,
  randomFn: () => number = Math.random
): MusicalNote {
  if (availableNotes.length === 0) {
    throw new Error('A lista de notas disponíveis não pode ser vazia.');
  }
  if (availableNotes.length === 1) {
    return availableNotes[0];
  }

  const candidates =
    previousNoteMidi !== undefined
      ? availableNotes.filter((n) => n.midi !== previousNoteMidi)
      : availableNotes;

  const pool = candidates.length > 0 ? candidates : availableNotes;
  const index = Math.floor(randomFn() * pool.length);
  return pool[Math.min(index, pool.length - 1)];
}

/**
 * Gera uma dica verdadeira e pedagógica sobre a frequência ou posição espectral
 * da nota sorteada, sem entregar diretamente o nome ou o valor exato da frequência.
 */
export function generateHintForNote(
  note: MusicalNote,
  difficulty: DifficultyLevel,
  _sampleRate = 48000,
  _fftSize = 16384
): string {
  // Dica relativa: reduz o espaço de busca pela metade sem revelar a frequência,
  // já que valores em Hz permitiriam deduzir a nota sem ouvir.
  const semitoneInOctave = ((note.midi % 12) + 12) % 12;
  const bandHint =
    semitoneInOctave < 5
      ? 'O pico dominante do espectro está na metade grave da oitava (entre Dó e Mi).'
      : 'O pico dominante do espectro está na metade aguda da oitava (entre Fá e Si).';

  if (difficulty === 'easy') {
    return `${bandHint} Use o botão de referência para comparar: quanto mais aguda a nota, mais distante dela.`;
  }

  if (difficulty === 'intermediate') {
    const natureHint = note.isSharp
      ? 'Dica cromática: trata-se de uma nota alterada (sustenido / tecla preta).'
      : 'Dica cromática: trata-se de uma nota natural (tecla branca).';
    return `${bandHint} ${natureHint}`;
  }

  // Modo difícil: inclui informação sobre a região de oitava e faixa espectral
  const octaveRegion =
    note.octave === 3
      ? 'região grave (3ª oitava, entre ~130 Hz e ~250 Hz)'
      : note.octave === 4
        ? 'região central (4ª oitava, entre ~260 Hz e ~495 Hz)'
        : 'região aguda (5ª oitava, entre ~520 Hz e ~990 Hz)';

  return `${bandHint} Esta frequência pertence à ${octaveRegion}. ${
    note.isSharp ? 'É uma nota com sustenido (♯).' : 'É uma nota natural (sem sustenido).'
  }`;
}

/**
 * Gera uma explicação educativa dinâmica baseada nos resultados matemáticos reais da rodada.
 */
export function buildEducationalExplanation(params: {
  targetNote: MusicalNote;
  selectedNote: MusicalNote;
  isCorrect: boolean;
  pitchResult: PitchDetectionResult;
}): string {
  const { targetNote, selectedNote, isCorrect, pitchResult } = params;
  const fs = pitchResult.spectrum.sampleRate;
  const N = pitchResult.spectrum.fftSize;
  const deltaF = pitchResult.spectrum.frequencyResolution.toFixed(2).replace('.', ',');
  const kMax = pitchResult.dominantBin;
  const fTeo = targetNote.frequency.toFixed(2).replace('.', ',');
  const fEst = pitchResult.estimatedFrequency.toFixed(2).replace('.', ',');
  const errCents = (pitchResult.theoreticalErrorCents ?? 0).toFixed(2).replace('.', ',');
  const windowLabel = getWindowMetadata(pitchResult.spectrum.windowType).name;

  const comparisonPart = isCorrect
    ? `Você identificou corretamente a nota ${targetNote.fullName}!`
    : `Você selecionou ${selectedNote.fullName} (${selectedNote.frequency
        .toFixed(2)
        .replace('.', ',')} Hz), que difere em ${Math.abs(
        selectedNote.midi - targetNote.midi
      )} semitom(ns) da nota sorteada ${targetNote.fullName} (${fTeo} Hz).`;

  return `${comparisonPart} O sinal discreto foi amostrado a fs = ${fs} Hz e analisado com N = ${N} amostras usando ${windowLabel} (resolução Δf = fs/N = ${deltaF} Hz). A FFT localizou o pico de magnitude no bin k = ${kMax} e, com interpolação parabólica, estimou a frequência fundamental em ${fEst} Hz (desvio de ${errCents} cents). Convertendo via m = 69 + 12·log₂(f/440), obteve-se MIDI ${targetNote.midi} (${targetNote.fullName}).`;
}

/**
 * Cria o estado inicial de uma nova partida de 10 rodadas.
 */
export function createMatchState(
  difficulty: DifficultyLevel,
  randomFn: () => number = Math.random
): MatchState {
  const availableNotes = getNotesForDifficulty(difficulty);
  const firstNote = pickRandomNote(availableNotes, undefined, randomFn);

  return {
    difficulty,
    currentRound: 1,
    totalRounds: TOTAL_ROUNDS_PER_MATCH,
    score: 0,
    targetNote: firstNote,
    availableNotes,
    usedHintInCurrentRound: false,
    currentHintText: null,
    roundAnswered: false,
    matchFinished: false,
    history: [],
  };
}

/**
 * Ativa a dica na rodada atual, registrando a penalidade de pontuação da rodada.
 */
export function requestHintInMatch(
  state: MatchState,
  sampleRate = 48000,
  fftSize = 16384
): MatchState {
  if (state.roundAnswered || state.matchFinished) {
    return state;
  }
  const hint = generateHintForNote(state.targetNote, state.difficulty, sampleRate, fftSize);
  return {
    ...state,
    usedHintInCurrentRound: true,
    currentHintText: hint,
  };
}

/**
 * Registra a resposta do jogador para a rodada atual utilizando o resultado real da FFT.
 */
export function submitRoundAnswer(
  state: MatchState,
  selectedMidi: number,
  pitchResult: PitchDetectionResult,
  timbre: TimbreType
): { nextState: MatchState; roundRecord: RoundHistoryItem } {
  if (state.roundAnswered || state.matchFinished) {
    throw new Error('Esta rodada já foi respondida ou a partida já terminou.');
  }

  const selectedNote =
    state.availableNotes.find((n) => n.midi === selectedMidi) ??
    state.availableNotes[0];

  const isCorrect = selectedNote.midi === state.targetNote.midi;
  const pointsEarned = calculateRoundScore(isCorrect, state.usedHintInCurrentRound);

  const educationalExplanation = buildEducationalExplanation({
    targetNote: state.targetNote,
    selectedNote,
    isCorrect,
    pitchResult,
  });

  const roundRecord: RoundHistoryItem = {
    roundNumber: state.currentRound,
    targetNote: state.targetNote,
    selectedNote,
    isCorrect,
    usedHint: state.usedHintInCurrentRound,
    pointsEarned,
    detectedFrequency: pitchResult.estimatedFrequency,
    theoreticalFrequency: state.targetNote.frequency,
    errorHz:
      pitchResult.theoreticalErrorHz ??
      Math.abs(pitchResult.estimatedFrequency - state.targetNote.frequency),
    errorCents: pitchResult.theoreticalErrorCents ?? 0,
    dominantBin: pitchResult.dominantBin,
    windowType: pitchResult.spectrum.windowType,
    timbre,
    educationalExplanation,
  };

  const nextState: MatchState = {
    ...state,
    score: state.score + pointsEarned,
    roundAnswered: true,
    history: [...state.history, roundRecord],
  };

  return { nextState, roundRecord };
}

/**
 * Avança para a próxima rodada ou encerra a partida ao completar a 10ª rodada.
 */
export function advanceToNextRound(
  state: MatchState,
  randomFn: () => number = Math.random
): MatchState {
  if (!state.roundAnswered) {
    throw new Error('É necessário responder a rodada atual antes de avançar.');
  }

  if (state.currentRound >= state.totalRounds) {
    return {
      ...state,
      matchFinished: true,
    };
  }

  const nextNote = pickRandomNote(
    state.availableNotes,
    state.targetNote.midi,
    randomFn
  );

  return {
    ...state,
    currentRound: state.currentRound + 1,
    targetNote: nextNote,
    usedHintInCurrentRound: false,
    currentHintText: null,
    roundAnswered: false,
  };
}
