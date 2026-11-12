/**
 * Módulo de Janelamento (Windowing) em Tempo Discreto — Tópico 1.3 de PDS
 *
 * Na análise espectral via DTFT/DFT/FFT de sinais de duração finita, truncar um sinal
 * equivale a multiplicá-lo por uma janela retangular, o que causa vazamento espectral
 * (spectral leakage) quando a frequência do sinal não coincide exatamente com um múltiplo
 * inteiro da resolução espectral (Delta_f = fs / N).
 *
 * Funções de janelamento clássicas suavizam as bordas do bloco de amostras, reduzindo os
 * lóbulos laterais no domínio da frequência ao custo de um alargamento controlado do lóbulo principal:
 * - Retangular: w[n] = 1
 * - Hann:       w[n] = 0.5 * (1 - cos(2*pi*n / (N - 1)))
 * - Hamming:    w[n] = 0.54 - 0.46 * cos(2*pi*n / (N - 1))
 * - Blackman:   w[n] = 0.42 - 0.5 * cos(2*pi*n / (N - 1)) + 0.08 * cos(4*pi*n / (N - 1))
 */

export type WindowType = 'rectangular' | 'hann' | 'hamming' | 'blackman';

export interface WindowMetadata {
  id: WindowType;
  name: string;
  shortName: string;
  formula: string;
  mainLobeWidthBins: number;
  firstSidelobeDb: number;
  rolloffDbPerOctave: number;
}

export const WINDOW_METADATA: Record<WindowType, WindowMetadata> = {
  rectangular: {
    id: 'rectangular',
    name: 'Janela Retangular',
    shortName: 'Retangular',
    formula: 'w[n] = 1',
    mainLobeWidthBins: 2,
    firstSidelobeDb: -13.3,
    rolloffDbPerOctave: -6,
  },
  hann: {
    id: 'hann',
    name: 'Janela de Hann',
    shortName: 'Hann',
    formula: 'w[n] = 0,5 · (1 − cos(2πn / (N − 1)))',
    mainLobeWidthBins: 4,
    firstSidelobeDb: -31.5,
    rolloffDbPerOctave: -18,
  },
  hamming: {
    id: 'hamming',
    name: 'Janela de Hamming',
    shortName: 'Hamming',
    formula: 'w[n] = 0,54 − 0,46 · cos(2πn / (N − 1))',
    mainLobeWidthBins: 4,
    firstSidelobeDb: -42.7,
    rolloffDbPerOctave: -6,
  },
  blackman: {
    id: 'blackman',
    name: 'Janela de Blackman',
    shortName: 'Blackman',
    formula: 'w[n] = 0,42 − 0,5 · cos(2πn / (N − 1)) + 0,08 · cos(4πn / (N − 1))',
    mainLobeWidthBins: 6,
    firstSidelobeDb: -58.1,
    rolloffDbPerOctave: -18,
  },
};

export function getWindowMetadata(windowType: WindowType): WindowMetadata {
  return WINDOW_METADATA[windowType] ?? WINDOW_METADATA.hann;
}

export function isValidWindowType(value: unknown): value is WindowType {
  return (
    value === 'rectangular' ||
    value === 'hann' ||
    value === 'hamming' ||
    value === 'blackman'
  );
}

/**
 * Gera os coeficientes da janela retangular:
 * w[n] = 1 para 0 <= n <= N - 1
 */
export function createRectangularWindow(length: number): Float64Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('O tamanho da janela N deve ser um inteiro positivo.');
  }
  const window = new Float64Array(length);
  window.fill(1.0);
  return window;
}

/**
 * Gera os coeficientes da janela de Hann:
 * w[n] = 0.5 * (1 - cos((2 * pi * n) / (N - 1)))
 */
export function createHannWindow(length: number): Float64Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('O tamanho da janela N deve ser um inteiro positivo.');
  }
  const window = new Float64Array(length);
  if (length === 1) {
    window[0] = 1.0;
    return window;
  }
  const factor = (2 * Math.PI) / (length - 1);
  for (let n = 0; n < length; n++) {
    window[n] = 0.5 * (1 - Math.cos(factor * n));
  }
  return window;
}

/**
 * Gera os coeficientes da janela de Hamming:
 * w[n] = 0.54 - 0.46 * cos((2 * pi * n) / (N - 1))
 */
export function createHammingWindow(length: number): Float64Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('O tamanho da janela N deve ser um inteiro positivo.');
  }
  const window = new Float64Array(length);
  if (length === 1) {
    window[0] = 1.0;
    return window;
  }
  const factor = (2 * Math.PI) / (length - 1);
  for (let n = 0; n < length; n++) {
    window[n] = 0.54 - 0.46 * Math.cos(factor * n);
  }
  return window;
}

/**
 * Gera os coeficientes da janela de Blackman:
 * w[n] = 0.42 - 0.5 * cos((2 * pi * n) / (N - 1)) + 0.08 * cos((4 * pi * n) / (N - 1))
 */
export function createBlackmanWindow(length: number): Float64Array {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error('O tamanho da janela N deve ser um inteiro positivo.');
  }
  const window = new Float64Array(length);
  if (length === 1) {
    window[0] = 1.0;
    return window;
  }
  const factor = (2 * Math.PI) / (length - 1);
  for (let n = 0; n < length; n++) {
    const phase = factor * n;
    window[n] = 0.42 - 0.5 * Math.cos(phase) + 0.08 * Math.cos(2 * phase);
  }
  return window;
}

/**
 * Avalia o valor normalizado w(u) de uma janela para u em [0, 1] (usado na visualização de envoltória).
 */
export function evaluateWindowEnvelope(windowType: WindowType, normalizedIndex: number): number {
  const u = Math.max(0, Math.min(1, normalizedIndex));
  switch (windowType) {
    case 'rectangular':
      return 0.96;
    case 'hann':
      return 0.5 * (1 - Math.cos(2 * Math.PI * u));
    case 'hamming':
      return 0.54 - 0.46 * Math.cos(2 * Math.PI * u);
    case 'blackman':
      return 0.42 - 0.5 * Math.cos(2 * Math.PI * u) + 0.08 * Math.cos(4 * Math.PI * u);
  }
}

/**
 * Cria o vetor de coeficientes w[n] para qualquer tipo de janela suportado.
 */
export function createWindowCoefficients(length: number, windowType: WindowType): Float64Array {
  switch (windowType) {
    case 'hann':
      return createHannWindow(length);
    case 'hamming':
      return createHammingWindow(length);
    case 'blackman':
      return createBlackmanWindow(length);
    case 'rectangular':
    default:
      return createRectangularWindow(length);
  }
}

/**
 * Aplica a janela selecionada sobre um vetor de amostras discretas x[n]:
 * x_w[n] = x[n] * w[n]
 */
export function applyWindow(
  samples: ArrayLike<number>,
  windowType: WindowType
): { windowedSamples: Float64Array; windowCoefficients: Float64Array; coherentGain: number } {
  const N = samples.length;
  if (N === 0) {
    throw new Error('O vetor de amostras não pode ser vazio.');
  }

  const windowCoefficients = createWindowCoefficients(N, windowType);
  const windowedSamples = new Float64Array(N);

  let sumWindow = 0;
  for (let n = 0; n < N; n++) {
    const w = windowCoefficients[n];
    windowedSamples[n] = samples[n] * w;
    sumWindow += w;
  }

  const coherentGain = sumWindow / N;
  return {
    windowedSamples,
    windowCoefficients,
    coherentGain,
  };
}
