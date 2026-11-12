/**
 * Módulo de Cálculo de Espectro de Frequências
 *
 * A partir dos coeficientes complexos X[k] produzidos pela FFT, calcula:
 *   |X[k]| = sqrt(Re(X[k])^2 + Im(X[k])^2)
 *   f[k] = k * fs / N
 *
 * Pelo Teorema da Amostragem de Nyquist-Shannon e pela simetria conjugada da DFT
 * de sinais reais (|X[N - k]| = |X[k]|), apenas a primeira metade do espectro
 * (0 <= k <= N / 2, correspondendo a 0 <= f <= fs / 2) contém informação única.
 */

import { computeFFT } from './fft';
import { applyWindow, WindowType } from './windows';

export interface SpectrumAnalysis {
  /** Magnitudes brutas |X[k]| = sqrt(Re(X[k])^2 + Im(X[k])^2) para 0 <= k <= N/2 */
  magnitudes: Float64Array;
  /** Magnitudes normalizadas pela amplitude do sinal (0 a ~1) para exibição gráfica */
  normalizedMagnitudes: Float64Array;
  /** Magnitudes em decibéis (dB) relativas ao pico ou referência unitária */
  magnitudesDb: Float64Array;
  /** Frequência correspondente a cada bin k: f[k] = k * fs / N */
  frequencies: Float64Array;
  /** Amostras no domínio do tempo após aplicação da janela x_w[n] */
  windowedSamples: Float64Array;
  /** Coeficientes da janela w[n] aplicada */
  windowCoefficients: Float64Array;
  /** Taxa de amostragem fs em Hz */
  sampleRate: number;
  /** Número de amostras analisadas N */
  fftSize: number;
  /** Resolução espectral Delta_f = fs / N em Hz */
  frequencyResolution: number;
  /** Tipo de janela utilizada */
  windowType: WindowType;
}

/**
 * Converte índice espectral k em frequência em Hz:
 * f[k] = k * fs / N
 */
export function binToFrequency(k: number, sampleRate: number, fftSize: number): number {
  if (fftSize <= 0 || sampleRate <= 0) {
    throw new Error('fftSize e sampleRate devem ser valores positivos.');
  }
  return (k * sampleRate) / fftSize;
}

/**
 * Converte uma frequência em Hz no índice espectral (bin) fracionário correspondente:
 * k = f * N / fs
 */
export function frequencyToBin(frequency: number, sampleRate: number, fftSize: number): number {
  if (fftSize <= 0 || sampleRate <= 0) {
    throw new Error('fftSize e sampleRate devem ser valores positivos.');
  }
  return (frequency * fftSize) / sampleRate;
}

/**
 * Calcula a resolução espectral (espaçamento entre bins da DFT):
 * Delta_f = fs / N
 */
export function calculateFrequencyResolution(sampleRate: number, fftSize: number): number {
  if (fftSize <= 0 || sampleRate <= 0) {
    throw new Error('fftSize e sampleRate devem ser valores positivos.');
  }
  return sampleRate / fftSize;
}

/**
 * Extrai um bloco estável de N amostras do sinal (evitando ataque e decaimento).
 * Caso o sinal tenha exatamente N amostras, retorna todas; se for maior, extrai do centro/região estável.
 */
export function extractStableSegment(
  samples: ArrayLike<number>,
  fftSize: number,
  sampleRate: number,
  attackSeconds = 0.08
): Float64Array {
  if (samples.length < fftSize) {
    throw new Error(
      `O sinal possui apenas ${samples.length} amostras, mas a FFT requer N = ${fftSize}.`
    );
  }

  const attackSamples = Math.floor(attackSeconds * sampleRate);
  const maxStart = samples.length - fftSize;
  const startOffset = Math.min(Math.max(0, attackSamples), maxStart);

  const segment = new Float64Array(fftSize);
  for (let i = 0; i < fftSize; i++) {
    segment[i] = samples[startOffset + i];
  }
  return segment;
}

/**
 * Realiza a análise espectral completa de um segmento de sinal discreto x[n]:
 * 1. Aplica janela w[n] (Retangular ou Hann)
 * 2. Calcula a FFT de N pontos
 * 3. Calcula o módulo |X[k]| = sqrt(Re(X[k])^2 + Im(X[k])^2) para o espectro unilateral (0 <= k <= N/2)
 * 4. Associa cada bin k à frequência f[k] = k * fs / N
 */
export function analyzeSpectrum(
  segment: ArrayLike<number>,
  sampleRate: number,
  windowType: WindowType = 'hann'
): SpectrumAnalysis {
  const N = segment.length;
  if (sampleRate <= 0) {
    throw new Error('A taxa de amostragem fs deve ser positiva.');
  }

  const { windowedSamples, windowCoefficients, coherentGain } = applyWindow(segment, windowType);
  const { real, imag } = computeFFT(windowedSamples);

  const halfBins = (N >> 1) + 1;
  const magnitudes = new Float64Array(halfBins);
  const normalizedMagnitudes = new Float64Array(halfBins);
  const magnitudesDb = new Float64Array(halfBins);
  const frequencies = new Float64Array(halfBins);

  const frequencyResolution = calculateFrequencyResolution(sampleRate, N);
  const normFactor = 2.0 / (N * coherentGain);

  for (let k = 0; k < halfBins; k++) {
    const re = real[k];
    const im = imag[k];
    const mag = Math.hypot(re, im);

    magnitudes[k] = mag;
    // Compensação unilateral para amplitudes reais
    const normalized = k === 0 || k === N >> 1 ? mag / (N * coherentGain) : mag * normFactor;
    normalizedMagnitudes[k] = normalized;
    magnitudesDb[k] = 20 * Math.log10(Math.max(normalized, 1e-12));
    frequencies[k] = k * frequencyResolution;
  }

  return {
    magnitudes,
    normalizedMagnitudes,
    magnitudesDb,
    frequencies,
    windowedSamples,
    windowCoefficients,
    sampleRate,
    fftSize: N,
    frequencyResolution,
    windowType,
  };
}
