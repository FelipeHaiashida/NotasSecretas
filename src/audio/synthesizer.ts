/**
 * Módulo de Síntese Digital de Sinais Sonoros (Timbre de Piano Harmônico e Senoidal)
 *
 * Sintetiza amostras discretas x[n] diretamente a partir do modelo matemático:
 *
 * 1) Timbre Senoidal Puro:
 *    x[n] = A * E[n] * sen(2 * pi * f * n / fs)
 *
 * 2) Timbre de Piano Harmônico (Série de Fourier com 8 Harmônicos e Fases de Schroeder):
 *    x[n] = A * E[n] * sum_{h=1}^{8} a_h(n) * sen(2 * pi * h * f * n / fs + phi_h)
 *    onde a_1 = 1.0 e a_h < a_1 para h >= 2 (garantindo que a fundamental f permaneça
 *    como a componente espectral de maior magnitude e respeitando h * f < fs / 2 pelo
 *    Teorema de Nyquist-Shannon).
 *
 * O mesmo buffer sintetizado é utilizado tanto para reprodução no AudioContext
 * quanto para a análise espectral via FFT.
 */

export type TimbreType = 'sine' | 'harmonic';

export interface SynthesisOptions {
  /** Frequência fundamental f em Hz */
  frequency: number;
  /** Taxa de amostragem fs em Hz (ex.: 44100 ou 48000) */
  sampleRate: number;
  /** Duração total do som em segundos (padrão: 1.2s) */
  durationSeconds?: number;
  /** Amplitude máxima A no intervalo (0, 1] (padrão: 0.85) */
  amplitude?: number;
  /** Timbre escolhido: 'harmonic' (piano rico em harmônicos) ou 'sine' (senoidal puro) */
  timbre?: TimbreType;
  /** Duração do ataque em segundos para evitar cliques (padrão: 0.018s) */
  attackSeconds?: number;
  /** Duração do decaimento final (release) em segundos (padrão: 0.22s) */
  releaseSeconds?: number;
}

export interface SynthesizedSignal {
  /** Amostras discretas x[n] em Float32Array prontas para AudioBuffer e análise FFT */
  samples: Float32Array;
  /** Frequência fundamental utilizada na síntese (Hz) */
  frequency: number;
  /** Taxa de amostragem fs (Hz) */
  sampleRate: number;
  /** Duração em segundos */
  durationSeconds: number;
  /** Timbre utilizado */
  timbre: TimbreType;
}

/**
 * Pesos relativos dos harmônicos para o timbre de Piano Harmônico.
 * A fundamental (1º harmônico) possui peso 1.00, enquanto os harmônicos superiores (2f₀ a 8f₀)
 * dão corpo e brilho acústico de piano, facilitando a distinção auditiva entre notas
 * sem alterar a dominância da fundamental na FFT.
 */
const HARMONIC_WEIGHTS: ReadonlyArray<{ multiple: number; weight: number; phase: number }> = [
  { multiple: 1, weight: 1.0, phase: 0.0 },
  { multiple: 2, weight: 0.52, phase: 0.39 },
  { multiple: 3, weight: 0.3, phase: 1.18 },
  { multiple: 4, weight: 0.18, phase: 2.36 },
  { multiple: 5, weight: 0.11, phase: 0.79 },
  { multiple: 6, weight: 0.065, phase: 2.75 },
  { multiple: 7, weight: 0.038, phase: 1.96 },
  { multiple: 8, weight: 0.022, phase: 1.57 },
];

/**
 * Calcula o envelope temporal E[n] com ataque percussivo suave de piano,
 * mantendo ganho unitário constante (E[n] = 1.0) no platô central (onde a janela
 * de análise da FFT de N = 16.384 amostras opera) e decaimento acústico suave no final.
 */
export function computeEnvelopeSample(
  sampleIndex: number,
  totalSamples: number,
  attackSamples: number,
  releaseSamples: number
): number {
  if (sampleIndex < 0 || sampleIndex >= totalSamples) {
    return 0;
  }

  if (attackSamples > 0 && sampleIndex < attackSamples) {
    // Curva suave de 0 a 1 usando meio ciclo de cosseno
    return 0.5 * (1 - Math.cos((Math.PI * sampleIndex) / attackSamples));
  }

  // Mantém platô estacionário puro na janela de captura da FFT (até ~0,44s)
  // e aplica decaimento acústico natural de corda de piano na cauda sonora
  const stationaryPlateauEnd = Math.min(
    totalSamples - releaseSamples,
    Math.max(attackSamples + 1, Math.round(totalSamples * 0.38))
  );

  if (sampleIndex <= stationaryPlateauEnd) {
    return 1.0;
  }

  const tailLength = Math.max(1, totalSamples - stationaryPlateauEnd);
  const tailProgress = (sampleIndex - stationaryPlateauEnd) / tailLength;
  const expDecay = Math.exp(-2.6 * tailProgress);
  const smoothEnd = 0.5 * (1 + Math.cos(Math.PI * tailProgress));
  return expDecay * smoothEnd;
}

/**
 * Sintetiza o sinal discreto x[n] correspondente a uma nota musical.
 */
export function synthesizeNoteSamples(options: SynthesisOptions): SynthesizedSignal {
  const {
    frequency,
    sampleRate,
    durationSeconds = 1.2,
    amplitude = 0.85,
    timbre = 'harmonic',
    attackSeconds = 0.018,
    releaseSeconds = 0.22,
  } = options;

  if (!Number.isFinite(frequency) || frequency <= 0) {
    throw new Error('A frequência de síntese deve ser maior que zero.');
  }
  if (!Number.isFinite(sampleRate) || sampleRate <= 0) {
    throw new Error('A taxa de amostragem deve ser maior que zero.');
  }
  if (!Number.isFinite(durationSeconds) || durationSeconds <= 0) {
    throw new Error('A duração deve ser maior que zero.');
  }

  const totalSamples = Math.max(1, Math.round(durationSeconds * sampleRate));
  const attackSamples = Math.min(
    Math.floor(totalSamples * 0.2),
    Math.round(attackSeconds * sampleRate)
  );
  const releaseSamples = Math.min(
    Math.floor(totalSamples * 0.35),
    Math.round(releaseSeconds * sampleRate)
  );

  const samples = new Float32Array(totalSamples);
  const nyquistLimit = sampleRate / 2;
  const twoPiOverFs = (2 * Math.PI) / sampleRate;

  if (timbre === 'sine') {
    const omega = twoPiOverFs * frequency;
    for (let n = 0; n < totalSamples; n++) {
      const env = computeEnvelopeSample(n, totalSamples, attackSamples, releaseSamples);
      samples[n] = amplitude * env * Math.sin(omega * n);
    }
  } else {
    // Filtra harmônicos que respeitam o critério de Nyquist (h * f < fs / 2)
    const activeHarmonics = HARMONIC_WEIGHTS.filter(
      (h) => h.multiple * frequency < nyquistLimit
    );

    // Ataque de martelo de piano nos primeiros 65ms para dar definição auditiva clara à nota
    const hammerDecaySamples = Math.max(1, Math.round(0.035 * sampleRate));
    let maxAbs = 0;

    for (let n = 0; n < totalSamples; n++) {
      const env = computeEnvelopeSample(n, totalSamples, attackSamples, releaseSamples);
      const hammerBoost = n < attackSamples * 3 ? Math.exp(-n / hammerDecaySamples) * 0.35 : 0;

      let sum = 0;
      for (let i = 0; i < activeHarmonics.length; i++) {
        const h = activeHarmonics[i];
        const transientWeight = h.multiple >= 2 ? h.weight * (1 + hammerBoost) : h.weight;
        sum +=
          transientWeight *
          Math.sin(twoPiOverFs * (h.multiple * frequency) * n + h.phase);
      }
      const val = env * sum;
      samples[n] = val;
      const absVal = Math.abs(val);
      if (absVal > maxAbs) {
        maxAbs = absVal;
      }
    }

    // Normaliza o pico para aproveitar toda a faixa dinâmica sem clipping
    const scale = maxAbs > 0 ? amplitude / maxAbs : amplitude;
    for (let n = 0; n < totalSamples; n++) {
      samples[n] *= scale;
    }
  }

  return {
    samples,
    frequency,
    sampleRate,
    durationSeconds,
    timbre,
  };
}
