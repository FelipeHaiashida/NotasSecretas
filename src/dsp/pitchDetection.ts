/**
 * Módulo de Detecção de Frequência Fundamental (Pitch Detection) via Espectro FFT
 *
 * Identifica o pico dominante no espectro de frequências unilateral (desprezando DC e
 * frequências fora da faixa de interesse musical) e aplica interpolação parabólica
 * entre os bins vizinhos (k-1, k, k+1) para obter resolução sub-bin.
 *
 * Interpolação parabólica sobre as magnitudes (ou log-magnitudes):
 *   delta = 0.5 * (alpha - gamma) / (alpha - 2*beta + gamma)
 *   k_interpolado = k_pico + delta
 *   f_estimada = k_interpolado * fs / N
 */

import {
  calculateAbsoluteErrorHz,
  calculateCentsError,
  DetectedNoteResult,
  frequencyToMusicalNote,
} from '../music/notes';
import { analyzeSpectrum, binToFrequency, extractStableSegment, SpectrumAnalysis } from './spectrum';
import { WindowType } from './windows';

export const DEFAULT_FFT_SIZE = 16384;
export const MIN_DETECTABLE_FREQ_HZ = 50;
export const MAX_DETECTABLE_FREQ_HZ = 2500;
export const SILENCE_RMS_THRESHOLD = 1e-4;

export interface PitchDetectionResult {
  /** Indica se a detecção foi bem-sucedida */
  success: boolean;
  /** Mensagem de erro caso o sinal seja inválido ou silencioso */
  errorMessage?: string;
  /** Frequência fundamental estimada após interpolação parabólica (Hz) */
  estimatedFrequency: number;
  /** Frequência correspondente apenas ao bin inteiro dominante sem interpolação (Hz) */
  rawBinFrequency: number;
  /** Índice inteiro do bin espectral dominante k_max */
  dominantBin: number;
  /** Deslocamento sub-bin calculado pela interpolação parabólica (-0.5 <= delta <= +0.5) */
  parabolicOffset: number;
  /** Índice fracionário interpolado k_interp = dominantBin + parabolicOffset */
  interpolatedBin: number;
  /** Magnitude espectral no bin dominante |X[k_max]| */
  peakMagnitude: number;
  /** Nível RMS do trecho de sinal analisado */
  signalRms: number;
  /** Dados completos do espectro calculado */
  spectrum: SpectrumAnalysis;
  /** Nota musical identificada a partir da frequência estimada */
  detectedNote: DetectedNoteResult | null;
  /** Erro absoluto em relação a uma frequência teórica de referência (se fornecida) */
  theoreticalErrorHz?: number;
  /** Erro em cents em relação a uma frequência teórica de referência (se fornecida) */
  theoreticalErrorCents?: number;
}

/**
 * Calcula o valor eficaz (RMS - Root Mean Square) de uma sequência discreta:
 * RMS = sqrt((1/N) * sum_{n=0}^{N-1} x[n]^2)
 */
export function calculateRMS(samples: ArrayLike<number>): number {
  const N = samples.length;
  if (N === 0) return 0;

  let sumSquares = 0;
  for (let i = 0; i < N; i++) {
    const val = samples[i];
    if (!Number.isFinite(val)) {
      throw new Error('O sinal contém amostras não numéricas (NaN ou Infinity).');
    }
    sumSquares += val * val;
  }
  return Math.sqrt(sumSquares / N);
}

/**
 * Realiza interpolação parabólica nos três bins ao redor do máximo (k-1, k, k+1).
 * Utiliza log-magnitude para maior precisão com a janela de Hann (cuja forma espectral
 * em dB próxima ao topo do lóbulo principal aproxima uma parábola).
 */
export function parabolicInterpolation(
  magnitudes: ArrayLike<number>,
  peakBin: number,
  useLogMagnitude = true
): number {
  if (peakBin <= 0 || peakBin >= magnitudes.length - 1) {
    return 0;
  }

  const mLeft = magnitudes[peakBin - 1];
  const mCenter = magnitudes[peakBin];
  const mRight = magnitudes[peakBin + 1];

  if (mCenter <= 0 || mLeft < 0 || mRight < 0) {
    return 0;
  }

  const alpha = useLogMagnitude ? Math.log(Math.max(mLeft, 1e-15)) : mLeft;
  const beta = useLogMagnitude ? Math.log(Math.max(mCenter, 1e-15)) : mCenter;
  const gamma = useLogMagnitude ? Math.log(Math.max(mRight, 1e-15)) : mRight;

  const denominator = alpha - 2 * beta + gamma;
  if (Math.abs(denominator) < 1e-15) {
    return 0;
  }

  const delta = (0.5 * (alpha - gamma)) / denominator;
  if (!Number.isFinite(delta) || Math.abs(delta) > 1.0) {
    return 0;
  }
  return delta;
}

/**
 * Executa o pipeline completo de detecção de frequência fundamental via FFT:
 * 1. Valida o sinal e verifica se não é silêncio
 * 2. Extrai um segmento estável de N amostras (padrão N = 16384)
 * 3. Aplica a janela (Retangular ou Hann) e executa a FFT
 * 4. Localiza o pico dominante na banda musical [MIN_DETECTABLE_FREQ_HZ, MAX_DETECTABLE_FREQ_HZ]
 * 5. Refina a estimativa com interpolação parabólica entre bins
 * 6. Converte a frequência estimada na nota musical correspondente e calcula os erros
 */
export function detectPitchFromSamples(
  samples: ArrayLike<number>,
  sampleRate: number,
  options: {
    fftSize?: number;
    windowType?: WindowType;
    theoreticalFrequency?: number;
    minFreqHz?: number;
    maxFreqHz?: number;
  } = {}
): PitchDetectionResult {
  const fftSize = options.fftSize ?? DEFAULT_FFT_SIZE;
  const windowType = options.windowType ?? 'hann';
  const minFreqHz = options.minFreqHz ?? MIN_DETECTABLE_FREQ_HZ;
  const maxFreqHz = options.maxFreqHz ?? MAX_DETECTABLE_FREQ_HZ;

  if (!samples || samples.length === 0) {
    throw new Error('O vetor de amostras de áudio está vazio.');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('Taxa de amostragem inválida.');
  }

  const segment =
    samples.length === fftSize
      ? Float64Array.from(samples)
      : extractStableSegment(samples, fftSize, sampleRate);

  const signalRms = calculateRMS(segment);
  const spectrum = analyzeSpectrum(segment, sampleRate, windowType);

  if (signalRms < SILENCE_RMS_THRESHOLD) {
    return {
      success: false,
      errorMessage: 'Sinal com energia insuficiente (silêncio detectado).',
      estimatedFrequency: 0,
      rawBinFrequency: 0,
      dominantBin: 0,
      parabolicOffset: 0,
      interpolatedBin: 0,
      peakMagnitude: 0,
      signalRms,
      spectrum,
      detectedNote: null,
    };
  }

  // Determina a faixa de índices k correspondentes à região de interesse musical (ignorando DC k=0)
  const minBin = Math.max(1, Math.floor((minFreqHz * fftSize) / sampleRate));
  const maxBin = Math.min(
    spectrum.magnitudes.length - 2,
    Math.ceil((maxFreqHz * fftSize) / sampleRate)
  );

  let dominantBin = minBin;
  let peakMagnitude = -1;

  for (let k = minBin; k <= maxBin; k++) {
    if (spectrum.magnitudes[k] > peakMagnitude) {
      peakMagnitude = spectrum.magnitudes[k];
      dominantBin = k;
    }
  }

  if (peakMagnitude <= 0) {
    return {
      success: false,
      errorMessage: 'Nenhum pico espectral válido encontrado na faixa musical.',
      estimatedFrequency: 0,
      rawBinFrequency: 0,
      dominantBin: 0,
      parabolicOffset: 0,
      interpolatedBin: 0,
      peakMagnitude: 0,
      signalRms,
      spectrum,
      detectedNote: null,
    };
  }

  // Interpolação parabólica sub-bin (log-magnitude para janelas suaves de cosseno: Hann, Hamming e Blackman)
  const useLog = windowType !== 'rectangular';
  const parabolicOffset = parabolicInterpolation(spectrum.magnitudes, dominantBin, useLog);
  const interpolatedBin = dominantBin + parabolicOffset;

  const rawBinFrequency = binToFrequency(dominantBin, sampleRate, fftSize);
  const estimatedFrequency = binToFrequency(interpolatedBin, sampleRate, fftSize);

  const detectedNote = frequencyToMusicalNote(estimatedFrequency);

  let theoreticalErrorHz: number | undefined;
  let theoreticalErrorCents: number | undefined;

  if (options.theoreticalFrequency && options.theoreticalFrequency > 0) {
    theoreticalErrorHz = calculateAbsoluteErrorHz(
      estimatedFrequency,
      options.theoreticalFrequency
    );
    theoreticalErrorCents = calculateCentsError(
      estimatedFrequency,
      options.theoreticalFrequency
    );
  }

  return {
    success: true,
    estimatedFrequency,
    rawBinFrequency,
    dominantBin,
    parabolicOffset,
    interpolatedBin,
    peakMagnitude,
    signalRms,
    spectrum,
    detectedNote,
    theoreticalErrorHz,
    theoreticalErrorCents,
  };
}
