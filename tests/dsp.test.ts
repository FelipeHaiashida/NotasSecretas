import { describe, expect, it } from 'vitest';
import { synthesizeNoteSamples } from '../src/audio/synthesizer';
import { computeFFT, computeNaiveDFT } from '../src/dsp/fft';
import { DEFAULT_FFT_SIZE, detectPitchFromSamples } from '../src/dsp/pitchDetection';
import { calculateFrequencyResolution } from '../src/dsp/spectrum';
import {
  applyWindow,
  createBlackmanWindow,
  createHammingWindow,
  createHannWindow,
  createRectangularWindow,
  getWindowMetadata,
} from '../src/dsp/windows';
import {
  calculateAbsoluteErrorHz,
  calculateCentsError,
  frequencyToExactMidi,
  frequencyToMusicalNote,
  frequencyToNearestMidi,
  getNoteFromMidi,
  midiToFrequency,
} from '../src/music/notes';

describe('Testes Matemáticos — Escala Temperada e Conversão MIDI/Frequência', () => {
  it('deve converter Lá4 (MIDI 69) exatamente para 440,00 Hz', () => {
    expect(midiToFrequency(69)).toBeCloseTo(440.0, 8);
    expect(frequencyToExactMidi(440.0)).toBeCloseTo(69, 8);
    expect(frequencyToNearestMidi(440.0)).toBe(69);
  });

  it('deve calcular Dó4 (MIDI 60) ≈ 261,63 Hz e demais notas naturais da 4ª oitava', () => {
    expect(midiToFrequency(60)).toBeCloseTo(261.625565, 4); // Dó4
    expect(midiToFrequency(62)).toBeCloseTo(293.664768, 4); // Ré4
    expect(midiToFrequency(64)).toBeCloseTo(329.627557, 4); // Mi4
    expect(midiToFrequency(65)).toBeCloseTo(349.228231, 4); // Fá4
    expect(midiToFrequency(67)).toBeCloseTo(391.995436, 4); // Sol4
    expect(midiToFrequency(71)).toBeCloseTo(493.883301, 4); // Si4
  });

  it('deve manter inversibilidade entre midiToFrequency e frequencyToExactMidi de Dó3 a Si5', () => {
    for (let midi = 48; midi <= 83; midi++) {
      const f = midiToFrequency(midi);
      const recoveredMidi = frequencyToExactMidi(f);
      expect(recoveredMidi).toBeCloseTo(midi, 8);
      const noteInfo = frequencyToMusicalNote(f);
      expect(noteInfo.note.midi).toBe(midi);
      expect(noteInfo.absoluteErrorHz).toBeLessThan(1e-7);
    }
  });

  it('deve calcular erro absoluto em Hz e erro em cents corretamente', () => {
    expect(calculateAbsoluteErrorHz(442, 440)).toBeCloseTo(2.0, 6);
    // Uma oitava acima = +1200 cents; um semitom acima = +100 cents
    expect(calculateCentsError(880, 440)).toBeCloseTo(1200, 6);
    expect(calculateCentsError(midiToFrequency(70), 440)).toBeCloseTo(100, 6);
  });
});

describe('Testes Matemáticos — Janelamento, Resolução Espectral e FFT Radix-2', () => {
  it('deve calcular a Janela de Hann com extremidades nulas e máximo unitário no centro', () => {
    const N = 1024;
    const hann = createHannWindow(N);
    expect(hann.length).toBe(N);
    expect(hann[0]).toBeCloseTo(0.0, 10);
    expect(hann[N - 1]).toBeCloseTo(0.0, 10);
    // Centro simétrico próximo de 1.0
    const mid = Math.floor((N - 1) / 2);
    expect(hann[mid]).toBeGreaterThan(0.999);

    const rect = createRectangularWindow(N);
    expect(rect[0]).toBe(1.0);
    expect(rect[N - 1]).toBe(1.0);

    const hamming = createHammingWindow(N);
    expect(hamming[0]).toBeCloseTo(0.08, 6);
    expect(hamming[N - 1]).toBeCloseTo(0.08, 6);
    expect(hamming[mid]).toBeGreaterThan(0.999);

    const blackman = createBlackmanWindow(N);
    expect(blackman[0]).toBeCloseTo(0.0, 6);
    expect(blackman[N - 1]).toBeCloseTo(0.0, 6);
    expect(blackman[mid]).toBeGreaterThan(0.999);

    expect(getWindowMetadata('hann').firstSidelobeDb).toBeCloseTo(-31.5, 1);
    expect(getWindowMetadata('hamming').firstSidelobeDb).toBeCloseTo(-42.7, 1);
    expect(getWindowMetadata('blackman').firstSidelobeDb).toBeCloseTo(-58.1, 1);
  });

  it('deve calcular corretamente a resolução espectral Δf = fs / N', () => {
    expect(calculateFrequencyResolution(48000, 16384)).toBeCloseTo(2.9296875, 6);
    expect(calculateFrequencyResolution(44100, 16384)).toBeCloseTo(2.69165039, 6);
  });

  it('deve produzir na FFT Radix-2 o mesmo resultado da DFT direta O(N²) para um sinal arbitrário', () => {
    const N = 64;
    const signal = new Float64Array(N);
    for (let n = 0; n < N; n++) {
      signal[n] =
        Math.sin((2 * Math.PI * 5 * n) / N) + 0.5 * Math.cos((2 * Math.PI * 12 * n) / N);
    }

    const fftRes = computeFFT(signal);
    const dftRes = computeNaiveDFT(signal);

    for (let k = 0; k < N; k++) {
      expect(fftRes.real[k]).toBeCloseTo(dftRes.real[k], 7);
      expect(fftRes.imag[k]).toBeCloseTo(dftRes.imag[k], 7);
    }
  });

  it('deve concentrar a energia exatamente no bin k0 para um sinal senoidal alinhado ao bin com janela retangular', () => {
    const N = 1024;
    const fs = 48000;
    const targetBin = 10;
    const freq = (targetBin * fs) / N;
    const signal = new Float64Array(N);

    for (let n = 0; n < N; n++) {
      signal[n] = Math.sin((2 * Math.PI * freq * n) / fs);
    }

    const { windowedSamples } = applyWindow(signal, 'rectangular');
    const spectrum = computeFFT(windowedSamples);

    const peakMag = Math.hypot(spectrum.real[targetBin], spectrum.imag[targetBin]);
    expect(peakMag).toBeCloseTo(N / 2, 5);

    // Demais bins devem ter magnitude praticamente zero (ausência de vazamento quando f = k*fs/N)
    const neighborMag = Math.hypot(
      spectrum.real[targetBin + 1],
      spectrum.imag[targetBin + 1]
    );
    expect(neighborMag).toBeLessThan(1e-7);
  });
});

describe('Testes Matemáticos — Detecção Espectral de Frequências e Notas Musicais', () => {
  const sampleRate = 48000;

  it.each([
    { freq: 220.0, expectedName: 'Lá3', expectedMidi: 57 },
    { freq: 261.625565, expectedName: 'Dó4', expectedMidi: 60 },
    { freq: 440.0, expectedName: 'Lá4', expectedMidi: 69 },
    { freq: 523.251131, expectedName: 'Dó5', expectedMidi: 72 },
  ])(
    'deve estimar com alta precisão f = $freq Hz ($expectedName) em condições ideais',
    ({ freq, expectedName, expectedMidi }) => {
      const synth = synthesizeNoteSamples({
        frequency: freq,
        sampleRate,
        durationSeconds: 1.0,
        timbre: 'sine',
      });

      const result = detectPitchFromSamples(synth.samples, sampleRate, {
        fftSize: DEFAULT_FFT_SIZE,
        windowType: 'hann',
        theoreticalFrequency: freq,
      });

      expect(result.success).toBe(true);
      expect(result.estimatedFrequency).toBeCloseTo(freq, 1);
      expect(result.detectedNote?.note.midi).toBe(expectedMidi);
      expect(result.detectedNote?.note.fullName).toBe(expectedName);
      expect(Math.abs(result.theoreticalErrorCents ?? 999)).toBeLessThan(1.5);
    }
  );

  it('deve identificar corretamente todas as 36 notas cromáticas de Dó3 (MIDI 48) a Si5 (MIDI 83) tanto para timbre senoidal quanto harmônico', () => {
    for (const timbre of ['sine', 'harmonic'] as const) {
      for (let midi = 48; midi <= 83; midi++) {
        const note = getNoteFromMidi(midi);
        const synth = synthesizeNoteSamples({
          frequency: note.frequency,
          sampleRate,
          durationSeconds: 0.8,
          timbre,
        });

        const result = detectPitchFromSamples(synth.samples, sampleRate, {
          fftSize: DEFAULT_FFT_SIZE,
          windowType: 'hann',
          theoreticalFrequency: note.frequency,
        });

        expect(result.success).toBe(true);
        expect(result.detectedNote?.note.midi).toBe(midi);
        expect(result.detectedNote?.note.fullName).toBe(note.fullName);
        expect(Math.abs(result.theoreticalErrorCents ?? 100)).toBeLessThan(3.0);
      }
    }
  });

  it('deve tratar silêncio e entradas inválidas de maneira segura sem simular resultados', () => {
    const silence = new Float32Array(DEFAULT_FFT_SIZE);
    const silenceResult = detectPitchFromSamples(silence, sampleRate);
    expect(silenceResult.success).toBe(false);
    expect(silenceResult.detectedNote).toBeNull();
    expect(silenceResult.errorMessage).toBeDefined();

    expect(() => detectPitchFromSamples([], sampleRate)).toThrow();
    expect(() => detectPitchFromSamples(silence, -48000)).toThrow();
    expect(() => midiToFrequency(NaN)).toThrow();
    expect(() => frequencyToExactMidi(0)).toThrow();
    expect(() => frequencyToExactMidi(-100)).toThrow();
  });

  it('deve medir e validar a tabela comparativa real de erro em Hz e cents (fs = 48000 Hz, N = 16384, Janela de Hann)', () => {
    const testMidis = [48, 57, 60, 62, 64, 65, 67, 69, 71, 72, 81, 83];
    const rows = testMidis.map((midi) => {
      const note = getNoteFromMidi(midi);
      const synth = synthesizeNoteSamples({
        frequency: note.frequency,
        sampleRate,
        durationSeconds: 1.0,
        timbre: 'sine',
      });
      const res = detectPitchFromSamples(synth.samples, sampleRate, {
        fftSize: DEFAULT_FFT_SIZE,
        windowType: 'hann',
        theoreticalFrequency: note.frequency,
      });
      return {
        note: note.fullName,
        midi,
        fTeo: note.frequency.toFixed(4),
        fEst: res.estimatedFrequency.toFixed(4),
        bin: res.dominantBin,
        errHz: (res.theoreticalErrorHz ?? 0).toFixed(4),
        errCents: (res.theoreticalErrorCents ?? 0).toFixed(4),
      };
    });
    console.table(rows);
    expect(rows).toHaveLength(12);
    rows.forEach((r) => {
      expect(Math.abs(Number(r.errCents))).toBeLessThan(1.5);
    });
  });
});
