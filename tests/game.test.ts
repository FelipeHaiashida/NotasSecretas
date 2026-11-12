import { describe, expect, it } from 'vitest';
import { synthesizeNoteSamples } from '../src/audio/synthesizer';
import { DEFAULT_FFT_SIZE, detectPitchFromSamples } from '../src/dsp/pitchDetection';
import {
  advanceToNextRound,
  createMatchState,
  generateHintForNote,
  getNotesForDifficulty,
  pickRandomNote,
  requestHintInMatch,
  submitRoundAnswer,
} from '../src/game/gameLogic';
import {
  calculateRoundScore,
  MAX_MATCH_SCORE,
  POINTS_CORRECT_NO_HINT,
  POINTS_CORRECT_WITH_HINT,
  POINTS_INCORRECT,
  TOTAL_ROUNDS_PER_MATCH,
} from '../src/game/scoring';

describe('Testes das Regras do Jogo — Dificuldades, Sorteio, Dicas e Pontuação', () => {
  it('deve restringir corretamente as notas disponíveis por modo de dificuldade', () => {
    const easyNotes = getNotesForDifficulty('easy');
    expect(easyNotes).toHaveLength(7);
    expect(easyNotes.every((n) => !n.isSharp && n.octave === 4)).toBe(true);
    expect(easyNotes.map((n) => n.fullName)).toEqual([
      'Dó4',
      'Ré4',
      'Mi4',
      'Fá4',
      'Sol4',
      'Lá4',
      'Si4',
    ]);

    const interNotes = getNotesForDifficulty('intermediate');
    expect(interNotes).toHaveLength(12);
    expect(interNotes.every((n) => n.octave === 4)).toBe(true);
    expect(interNotes.some((n) => n.isSharp)).toBe(true);

    const hardNotes = getNotesForDifficulty('hard');
    expect(hardNotes).toHaveLength(36);
    expect(hardNotes[0].fullName).toBe('Dó3');
    expect(hardNotes[hardNotes.length - 1].fullName).toBe('Si5');
  });

  it('deve evitar repetições consecutivas da mesma nota no sorteio', () => {
    const notes = getNotesForDifficulty('easy');
    let previousMidi = notes[0].midi;

    // Mesmo forçando gerador aleatório constante (0), nunca deve repetir a nota imediatamente anterior
    for (let i = 0; i < 30; i++) {
      const next = pickRandomNote(notes, previousMidi, () => 0);
      expect(next.midi).not.toBe(previousMidi);
      previousMidi = next.midi;
    }
  });

  it('deve calcular a pontuação de cada rodada e aplicar a penalidade de dica corretamente', () => {
    expect(calculateRoundScore(true, false)).toBe(POINTS_CORRECT_NO_HINT); // 100
    expect(calculateRoundScore(true, true)).toBe(POINTS_CORRECT_WITH_HINT); // 60
    expect(calculateRoundScore(false, false)).toBe(POINTS_INCORRECT); // 0
    expect(calculateRoundScore(false, true)).toBe(POINTS_INCORRECT); // 0
    expect(MAX_MATCH_SCORE).toBe(1000);
  });

  it('deve gerar dicas verdadeiras compatíveis com a nota sorteada sem revelar seu nome', () => {
    const easyNotes = getNotesForDifficulty('easy');
    const c4 = easyNotes[0]; // Dó4 ≈ 261.63 Hz
    const hint = generateHintForNote(c4, 'easy', 48000, DEFAULT_FFT_SIZE);

    expect(hint).toContain('ABAIXO da referência Lá4');
    expect(hint).toContain('250 Hz e 300 Hz');
    expect(hint).not.toContain('Dó4');
  });

  it('deve conduzir uma partida completa de 10 rodadas, encerrar na 10ª e permitir reinício', () => {
    let state = createMatchState('intermediate');
    expect(state.currentRound).toBe(1);
    expect(state.totalRounds).toBe(TOTAL_ROUNDS_PER_MATCH);
    expect(state.score).toBe(0);

    for (let round = 1; round <= TOTAL_ROUNDS_PER_MATCH; round++) {
      expect(state.currentRound).toBe(round);
      expect(state.matchFinished).toBe(false);

      // Usa dica apenas na rodada 2
      if (round === 2) {
        state = requestHintInMatch(state);
        expect(state.usedHintInCurrentRound).toBe(true);
        expect(state.currentHintText).toBeTruthy();
      }

      // Sintetiza o sinal real da rodada e detecta via FFT
      const signal = synthesizeNoteSamples({
        frequency: state.targetNote.frequency,
        sampleRate: 48000,
        durationSeconds: 0.6,
      });
      const pitchResult = detectPitchFromSamples(signal.samples, 48000, {
        fftSize: DEFAULT_FFT_SIZE,
        theoreticalFrequency: state.targetNote.frequency,
      });

      // Na rodada 3 erra propositalmente; nas demais acerta
      const wrongCandidate = state.availableNotes.find(
        (n) => n.midi !== state.targetNote.midi
      )!;
      const chosenMidi = round === 3 ? wrongCandidate.midi : state.targetNote.midi;

      const { nextState, roundRecord } = submitRoundAnswer(
        state,
        chosenMidi,
        pitchResult,
        'sine'
      );

      if (round === 2) {
        expect(roundRecord.pointsEarned).toBe(60);
      } else if (round === 3) {
        expect(roundRecord.pointsEarned).toBe(0);
      } else {
        expect(roundRecord.pointsEarned).toBe(100);
      }

      state = advanceToNextRound(nextState);
    }

    expect(state.matchFinished).toBe(true);
    expect(state.history).toHaveLength(10);
    // 8 acertos sem dica (800) + 1 acerto com dica (60) + 1 erro (0) = 860 pontos
    expect(state.score).toBe(860);

    // Reinício do jogo
    const restarted = createMatchState('easy');
    expect(restarted.currentRound).toBe(1);
    expect(restarted.score).toBe(0);
    expect(restarted.matchFinished).toBe(false);
    expect(restarted.history).toHaveLength(0);
  });
});
