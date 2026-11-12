/**
 * Módulo da Transformada Rápida de Fourier (FFT) e Transformada Discreta de Fourier (DFT)
 *
 * A Transformada Discreta de Fourier (DFT) de uma sequência finita x[n] de comprimento N é definida por:
 *   X[k] = sum_{n=0}^{N-1} x[n] * e^(-j * 2 * pi * k * n / N), para k = 0, 1, ..., N - 1
 *
 * A DFT amostra em frequência a Transformada de Fourier de Tempo Discreto (DTFT) do sinal janelado
 * nos pontos igualmente espaçados omega_k = 2 * pi * k / N.
 *
 * Este módulo implementa o algoritmo FFT Radix-2 Cooley-Tukey in-place por dizimação no tempo (DIT),
 * reduzindo a complexidade computacional de O(N^2) da DFT direta para O(N log2 N).
 */

export interface ComplexSpectrum {
  /** Parte real Re(X[k]) */
  real: Float64Array;
  /** Parte imaginária Im(X[k]) */
  imag: Float64Array;
  /** Tamanho da transformada N */
  size: number;
}

/**
 * Verifica se um número inteiro N é potência de 2 (N = 2^p).
 */
export function isPowerOfTwo(n: number): boolean {
  return Number.isInteger(n) && n > 0 && (n & (n - 1)) === 0;
}

/**
 * Calcula a FFT Radix-2 Cooley-Tukey sobre vetores reais e imaginários in-place.
 *
 * @param real Vetor com a parte real de entrada x[n]; ao final contém Re(X[k])
 * @param imag Vetor com a parte imaginária de entrada; ao final contém Im(X[k])
 */
export function fftInPlace(real: Float64Array, imag: Float64Array): void {
  const N = real.length;
  if (N !== imag.length) {
    throw new Error('Os vetores real e imaginário devem possuir o mesmo tamanho.');
  }
  if (!isPowerOfTwo(N)) {
    throw new Error(`O tamanho da FFT (${N}) deve ser uma potência de 2.`);
  }

  // Etapa 1: Permutação por reversão de bits (bit-reversal permutation)
  let j = 0;
  for (let i = 0; i < N; i++) {
    if (i < j) {
      const tempR = real[i];
      real[i] = real[j];
      real[j] = tempR;

      const tempI = imag[i];
      imag[i] = imag[j];
      imag[j] = tempI;
    }
    let m = N >> 1;
    while (m >= 1 && j >= m) {
      j -= m;
      m >>= 1;
    }
    j += m;
  }

  // Etapa 2: Estágios de borboleta (Butterfly stages) de Cooley-Tukey
  for (let size = 2; size <= N; size <<= 1) {
    const halfSize = size >> 1;
    const angleStep = (-2 * Math.PI) / size;

    // Fator de giro unitário (twiddle factor step): W_size = e^(-j * 2*pi / size)
    const wStepReal = Math.cos(angleStep);
    const wStepImag = Math.sin(angleStep);

    for (let i = 0; i < N; i += size) {
      let wReal = 1.0;
      let wImag = 0.0;

      for (let k = 0; k < halfSize; k++) {
        const evenIndex = i + k;
        const oddIndex = i + k + halfSize;

        // Multiplicação complexa: W * X_impar
        const tReal = wReal * real[oddIndex] - wImag * imag[oddIndex];
        const tImag = wReal * imag[oddIndex] + wImag * real[oddIndex];

        // Operação borboleta
        real[oddIndex] = real[evenIndex] - tReal;
        imag[oddIndex] = imag[evenIndex] - tImag;
        real[evenIndex] = real[evenIndex] + tReal;
        imag[evenIndex] = imag[evenIndex] + tImag;

        // Atualiza o twiddle factor: W <- W * W_step
        const nextWReal = wReal * wStepReal - wImag * wStepImag;
        wImag = wReal * wStepImag + wImag * wStepReal;
        wReal = nextWReal;
      }
    }
  }
}

/**
 * Calcula a FFT de um sinal real x[n] de comprimento N (potência de 2).
 */
export function computeFFT(signal: ArrayLike<number>): ComplexSpectrum {
  const N = signal.length;
  if (!isPowerOfTwo(N)) {
    throw new Error(`O tamanho do sinal (${N}) deve ser uma potência de 2 para a FFT.`);
  }

  const real = new Float64Array(N);
  const imag = new Float64Array(N);

  for (let n = 0; n < N; n++) {
    real[n] = signal[n];
    imag[n] = 0.0;
  }

  fftInPlace(real, imag);

  return {
    real,
    imag,
    size: N,
  };
}

/**
 * Calcula a DFT diretamente pela definição O(N^2) (útil para validação matemática em testes com N pequeno).
 * X[k] = sum_{n=0}^{N-1} x[n] * (cos(2*pi*k*n/N) - j*sin(2*pi*k*n/N))
 */
export function computeNaiveDFT(signal: ArrayLike<number>): ComplexSpectrum {
  const N = signal.length;
  const real = new Float64Array(N);
  const imag = new Float64Array(N);

  for (let k = 0; k < N; k++) {
    let sumReal = 0;
    let sumImag = 0;
    const baseAngle = (-2 * Math.PI * k) / N;

    for (let n = 0; n < N; n++) {
      const angle = baseAngle * n;
      sumReal += signal[n] * Math.cos(angle);
      sumImag += signal[n] * Math.sin(angle);
    }

    real[k] = sumReal;
    imag[k] = sumImag;
  }

  return { real, imag, size: N };
}
