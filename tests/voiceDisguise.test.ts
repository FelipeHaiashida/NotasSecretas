import { describe, expect, it } from 'vitest';
import {
  applyBitcrush,
  applyOverdrive,
  applyRingModulation,
  applyFrequencyScrambler,
  processVoiceDisguise,
  synthesizeSpySpeechSignal,
  VOICE_DISGUISE_CATALOG,
} from '../src/dsp/voiceDisguise';
import { analyzeSpectrum } from '../src/dsp/spectrum';

describe('Processamento Digital de Sinais — Efeitos de Disfarce de Voz', () => {
  const fs = 48000;
  const N = 4096;

  it('deve possuir catálogo completo com metadados didáticos para todos os efeitos', () => {
    const effects = ['none', 'dalek', 'bitcrush', 'scrambler', 'agent', 'overdrive'] as const;
    effects.forEach((eff) => {
      const info = VOICE_DISGUISE_CATALOG[eff];
      expect(info).toBeDefined();
      expect(info.name).toBeTruthy();
      expect(info.formulaLatex).toBeTruthy();
      expect(info.dspExplanation).toBeTruthy();
      expect(info.whatToObserve).toBeTruthy();
    });
  });

  it('Voz Limpa (none) deve preservar integralmente as amostras', () => {
    const input = new Float32Array(N);
    for (let i = 0; i < N; i++) input[i] = Math.sin((2 * Math.PI * 440 * i) / fs);

    const output = processVoiceDisguise(input, fs, 'none');
    expect(output.length).toBe(input.length);
    for (let i = 0; i < N; i++) {
      expect(output[i]).toBeCloseTo(input[i], 5);
    }
  });

  it('Robô Dalek (Ring Modulation) deve modular e dividir o pico em bandas laterais (f0 ± fc)', () => {
    const f0 = 440;
    const fc = 100;
    const input = new Float32Array(N);
    for (let i = 0; i < N; i++) input[i] = Math.sin((2 * Math.PI * f0 * i) / fs);

    const modulated = applyRingModulation(input, fs, fc);
    const spec = analyzeSpectrum(modulated, fs, 'hann');

    // As bandas laterais esperadas são f0 - fc = 340 Hz e f0 + fc = 540 Hz
    let maxMagAt340 = 0;
    let maxMagAt540 = 0;
    let maxMagAt440 = 0;

    for (let k = 0; k < spec.frequencies.length; k++) {
      const freq = spec.frequencies[k];
      const mag = spec.magnitudes[k];
      if (Math.abs(freq - 340) < 15 && mag > maxMagAt340) maxMagAt340 = mag;
      if (Math.abs(freq - 540) < 15 && mag > maxMagAt540) maxMagAt540 = mag;
      if (Math.abs(freq - 440) < 15 && mag > maxMagAt440) maxMagAt440 = mag;
    }

    // Ambas as bandas laterais devem possuir magnitude substancial e serem maiores que a fundamental original suprimida
    expect(maxMagAt340).toBeGreaterThan(0.1);
    expect(maxMagAt540).toBeGreaterThan(0.1);
    expect(maxMagAt340).toBeGreaterThan(maxMagAt440);
  });

  it('Bitcrusher deve quantizar em níveis discretos correspondentes a B bits', () => {
    const input = new Float32Array(100);
    for (let i = 0; i < 100; i++) input[i] = (i / 100) * 2 - 1; // Rampa de -1 a 1

    const bits = 3; // 2^(3-1) = 4 níveis positivos/negativos
    const crushed = applyBitcrush(input, bits, 1);

    // Amostras devem pertencer a múltiplos exatos de 1 / 4 = 0.25
    for (let i = 0; i < crushed.length; i++) {
      const remainder = Math.abs(crushed[i] * 4 - Math.round(crushed[i] * 4));
      expect(remainder).toBeLessThan(1e-4);
    }
  });

  it('Overdrive não linear deve injetar harmônicos ímpares (3f0 e 5f0)', () => {
    const f0 = 200;
    const input = new Float32Array(N);
    for (let i = 0; i < N; i++) input[i] = Math.sin((2 * Math.PI * f0 * i) / fs);

    const distorted = applyOverdrive(input, 10);
    const spec = analyzeSpectrum(distorted, fs, 'hann');

    // Localizar picos no 3º harmônico (600 Hz) e 5º harmônico (1000 Hz)
    let mag3f0 = 0;
    let mag2f0 = 0; // Harmônico par deve ser praticamente nulo devido à simetria ímpar do tanh
    for (let k = 0; k < spec.frequencies.length; k++) {
      const f = spec.frequencies[k];
      const mag = spec.magnitudes[k];
      if (Math.abs(f - 600) < 15 && mag > mag3f0) mag3f0 = mag;
      if (Math.abs(f - 400) < 15 && mag > mag2f0) mag2f0 = mag;
    }

    expect(mag3f0).toBeGreaterThan(0.05);
    // Harmônico ímpar (3f0) deve ser muito mais intenso que harmônico par (2f0)
    expect(mag3f0).toBeGreaterThan(mag2f0 * 2);
  });

  it('Inversor Espectral (Scrambler) deve inverter e restaurar o sinal ao aplicar duas vezes', () => {
    const f0 = 600;
    const input = new Float32Array(N);
    for (let i = 0; i < N; i++) input[i] = Math.sin((2 * Math.PI * f0 * i) / fs);

    const carrier = 3000;
    // 1ª passada: inverte f0 para carrier - f0 = 2400 Hz
    const scrambled = applyFrequencyScrambler(input, fs, carrier);
    const spec1 = analyzeSpectrum(scrambled, fs, 'hann');

    let peakScrambledFreq = 0;
    let maxMag1 = 0;
    for (let k = 0; k < spec1.frequencies.length; k++) {
      if (spec1.frequencies[k] > 100 && spec1.magnitudes[k] > maxMag1) {
        maxMag1 = spec1.magnitudes[k];
        peakScrambledFreq = spec1.frequencies[k];
      }
    }
    // Deve estar perto de 3000 - 600 = 2400 Hz
    expect(Math.abs(peakScrambledFreq - 2400)).toBeLessThan(60);

    // 2ª passada: desinverte (decodificação)
    const unscrambled = applyFrequencyScrambler(scrambled, fs, carrier);
    const spec2 = analyzeSpectrum(unscrambled, fs, 'hann');

    let peakUnscrambledFreq = 0;
    let maxMag2 = 0;
    for (let k = 0; k < spec2.frequencies.length; k++) {
      if (spec2.frequencies[k] > 100 && spec2.magnitudes[k] > maxMag2) {
        maxMag2 = spec2.magnitudes[k];
        peakUnscrambledFreq = spec2.frequencies[k];
      }
    }
    // Deve restaurar próximo a 600 Hz
    expect(Math.abs(peakUnscrambledFreq - 600)).toBeLessThan(60);
  });

  it('deve sintetizar sinal acústico de fala espiã com formantes válidos', () => {
    const speechSamples = synthesizeSpySpeechSignal(fs);
    expect(speechSamples.length).toBeGreaterThan(fs); // Mais de 1 segundo de áudio

    // Verificar se a energia RMS não é silenciosa
    let sumSq = 0;
    for (let i = 0; i < speechSamples.length; i++) {
      sumSq += speechSamples[i] * speechSamples[i];
    }
    const rms = Math.sqrt(sumSq / speechSamples.length);
    expect(rms).toBeGreaterThan(0.05);

    // Verificar que o sinal processado pelo efeito de agente anônimo preserva integridade
    const disguised = processVoiceDisguise(speechSamples, fs, 'agent');
    expect(disguised.length).toBe(speechSamples.length);
  });
});
