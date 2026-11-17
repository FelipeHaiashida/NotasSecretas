/**
 * Módulo de Efeitos de Processamento Digital de Sinais (PDS) para Disfarce de Voz
 *
 * Implementa transformações matemáticas sobre sinais de áudio discretos x[n]:
 *
 * 1) Modulação em Anel (Robô Dalek):
 *    y[n] = x[n] * cos(2 * pi * fc * n / fs)
 *    Pelo Teorema da Modulação de Fourier, duplica o espectro nas bandas laterais f +/- fc.
 *
 * 2) Bitcrusher & Quebrador de Nyquist (Rádio 8-bit / Espionagem Retrô):
 *    Quantização reduzida para B bits e subamostragem (downsampling com zero-order hold),
 *    demonstrando ruído de quantização e aliasing espectral na prática.
 *
 * 3) Criptografia SIGSALY (Frequency Inversion Scrambler):
 *    Inversão espectral em torno de uma subportadora de corte fc.
 *    Graves viram agudos e agudos viram graves. A aplicação do mesmo algoritmo decodifica o sinal.
 *
 * 4) Agente Secreto (Depoimento Anônimo / Rádio Militar):
 *    Filtro passa-faixa telefônico (300 Hz - 2600 Hz) combinado com modulação sub-harmônica
 *    e saturação suave para mascarar o timbre do locutor.
 *
 * 5) Saturação Extrema / Overdrive (Gerador de Harmônicos Ímpares):
 *    y[n] = tanh(k * x[n]). Função de transferência não linear ímpar que injeta
 *    exclusivamente harmônicos ímpares (3f₀, 5f₀, 7f₀...) visíveis na FFT.
 */

export type VoiceDisguiseType =
  | 'none'
  | 'dalek'
  | 'bitcrush'
  | 'scrambler'
  | 'agent'
  | 'overdrive';

export interface VoiceDisguiseInfo {
  id: VoiceDisguiseType;
  name: string;
  shortDesc: string;
  badge: string;
  formulaLatex: string;
  dspExplanation: string;
  whatToObserve: string;
}

export const VOICE_DISGUISE_CATALOG: Record<VoiceDisguiseType, VoiceDisguiseInfo> = {
  none: {
    id: 'none',
    name: 'Voz Direta (Limpa)',
    shortDesc: 'Sinal original sem processamento adicional.',
    badge: 'Referência',
    formulaLatex: 'y[n] = x[n]',
    dspExplanation:
      'Passagem direta do sinal acústico capturado pelo microfone para análise espectral de referência.',
    whatToObserve:
      'Observe a frequência fundamental f₀ da sua voz e os formantes naturais da laringe no espectro.',
  },
  dalek: {
    id: 'dalek',
    name: 'Robô Dalek (Ring Modulation)',
    shortDesc: 'Multiplica a voz por uma senóide pura, gerando timbre metálico alienígena.',
    badge: 'Teorema da Modulação',
    formulaLatex: 'y[n] = x[n] \\cdot \\cos\\left(\\frac{2\\pi f_c n}{f_s}\\right)',
    dspExplanation:
      'Pelo Teorema da Modulação de Fourier, multiplicar no tempo convoluciona no domínio da frequência. Cada frequência f da voz se divide em duas raias laterais (f − fc e f + fc), eliminando a harmonia natural.',
    whatToObserve:
      'Na FFT, repare que o pico principal da sua voz se divide em dois picos simétricos distanciados pela frequência portadora fc.',
  },
  bitcrush: {
    id: 'bitcrush',
    name: 'Rádio 8-bit (Quebrador de Nyquist)',
    shortDesc: 'Reduz a resolução de bits e a taxa de amostragem, forçando Aliasing e ruído.',
    badge: 'Quantização & Nyquist',
    formulaLatex: 'y[n] = \\text{quant}\\left(x[\\lfloor n/D \\rfloor \\cdot D], B\\right)',
    dspExplanation:
      'Demonstração prática de dois conceitos centrais de PDS: redução para B bits (ruído de quantização) e decimação por fator D sem filtro anti-aliasing (violação do Teorema de Nyquist-Shannon fs > 2fmax).',
    whatToObserve:
      'Na forma de onda, veja os degraus de quantização. Na FFT, observe uma elevação do piso de ruído e raias espelhadas (aliasing) voltando no espectro.',
  },
  agent: {
    id: 'agent',
    name: 'Agente Anônimo (Depoimento Secreto)',
    shortDesc: 'Voz grave, comprimida e com filtro passa-faixa telefônico de espionagem.',
    badge: 'Filtro Passa-Faixa & Saturação',
    formulaLatex: 'y[n] = \\text{sat}\\left(\\text{BPF}(x[n], 300\\text{ Hz}, 2600\\text{ Hz})\\right)',
    dspExplanation:
      'Imita os moduladores de voz táticos e comunicações sigilosas. Limita a banda à faixa telefônica padrão e introduz saturação suave e compressão para esconder a identidade vocal.',
    whatToObserve:
      'Na FFT, frequências abaixo de 300 Hz e acima de 2.600 Hz são atenuadas bruscamente pela curva de corte do filtro passa-faixa.',
  },
  scrambler: {
    id: 'scrambler',
    name: 'Criptografia SIGSALY (Inversão Espectral)',
    shortDesc: 'Inverte o espectro de frequências: graves viram agudos e agudos viram graves.',
    badge: 'Criptografia de Áudio da 2ª Guerra',
    formulaLatex: 'f\' = f_{\\text{inv}} - f \\quad (\\text{Inversão Espectral})',
    dspExplanation:
      'Técnica histórica do sistema SIGSALY e walkie-talkies sigilosos. A fala humana fica 100% ininteligível. Se passar o sinal pelo mesmo processo novamente, a voz original é matematicamente restaurada!',
    whatToObserve:
      'Ao falar sons graves (vogais como "U" ou "O"), veja picos surgindo no topo da banda de corte; sons agudos (como "S") aparecem nas baixas frequências.',
  },
  overdrive: {
    id: 'overdrive',
    name: 'Overdrive Extremo (Harmônicos Ímpares)',
    shortDesc: 'Distorção não linear hiperbólica geradora de múltiplos ímpares (3f₀, 5f₀, 7f₀).',
    badge: 'Distorção Não Linear',
    formulaLatex: 'y[n] = \\tanh(k \\cdot x[n])',
    dspExplanation:
      'Como a função tanh(u) possui simetria ímpar [tanh(-u) = -tanh(u)], sua expansão polinomial gera apenas harmônicos de ordem ímpar (3f₀, 5f₀, 7f₀...), achatando a crista da forma de onda.',
    whatToObserve:
      'Na forma de onda, a onda senoidal vira quase quadrada. Na FFT, observe uma "floresta" de harmônicos ímpares crescendo acima da fundamental.',
  },
};

export interface VoiceDisguiseParams {
  /** Frequência da portadora para Modulação em Anel / Scrambler (padrão: 120 Hz para dalek, 3200 Hz para scrambler) */
  carrierFrequency?: number;
  /** Quantidade de bits de resolução para o Bitcrusher (ex.: 2, 3, 4, 8) */
  bits?: number;
  /** Fator de subamostragem (downsample) para o Bitcrusher (ex.: 4 a 16) */
  downsampleFactor?: number;
  /** Ganho de saturação para o Overdrive (ex.: 4 a 15) */
  overdriveGain?: number;
}

/**
 * Modulação em Anel (Ring Modulation - Efeito Robô Dalek)
 * y[n] = x[n] * cos(2 * pi * carrierFreq * n / sampleRate)
 */
export function applyRingModulation(
  input: Float32Array,
  sampleRate: number,
  carrierFreq = 120
): Float32Array {
  const output = new Float32Array(input.length);
  const omega = (2 * Math.PI * carrierFreq) / sampleRate;

  for (let n = 0; n < input.length; n++) {
    output[n] = input[n] * Math.cos(omega * n);
  }
  return output;
}

/**
 * Bitcrusher & Downsampling (Quebrador de Nyquist / Rádio 8-bit)
 * Aplica quantização de B bits e taxa de amostragem reduzida com zero-order hold.
 */
export function applyBitcrush(
  input: Float32Array,
  bits = 4,
  downsampleFactor = 8
): Float32Array {
  const output = new Float32Array(input.length);
  const safeBits = Math.max(1, Math.min(16, Math.round(bits)));
  const steps = Math.pow(2, safeBits - 1);
  const safeD = Math.max(1, Math.round(downsampleFactor));

  let heldSample = 0;
  for (let n = 0; n < input.length; n++) {
    if (n % safeD === 0) {
      const clamped = Math.max(-1, Math.min(1, input[n]));
      // Quantização uniforme em B bits
      heldSample = Math.round(clamped * steps) / steps;
    }
    output[n] = heldSample;
  }
  return output;
}

/**
 * Filtro IIR Biquad Passa-Faixa (Band-pass) de 2 polos
 */
export function applyBiquadBandpass(
  input: Float32Array,
  sampleRate: number,
  centerFreq: number,
  q = 1.0
): Float32Array {
  const output = new Float32Array(input.length);
  const omega = (2 * Math.PI * centerFreq) / sampleRate;
  const sin = Math.sin(omega);
  const cos = Math.cos(omega);
  const alpha = sin / (2 * q);

  const b0 = alpha;
  const b1 = 0;
  const b2 = -alpha;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let n = 0; n < input.length; n++) {
    const x0 = input[n];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    output[n] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return output;
}

/**
 * Filtro IIR Biquad Passa-Baixa (Low-pass) de 2ª ordem Butterworth
 */
export function applyBiquadLowpass(
  input: Float32Array,
  sampleRate: number,
  cutoffFreq: number
): Float32Array {
  const output = new Float32Array(input.length);
  const safeCutoff = Math.min(cutoffFreq, sampleRate * 0.45);
  const omega = (2 * Math.PI * safeCutoff) / sampleRate;
  const cos = Math.cos(omega);
  const sin = Math.sin(omega);
  const alpha = sin / (2 * Math.SQRT2);

  const b1 = 1 - cos;
  const b0 = b1 / 2;
  const b2 = b0;
  const a0 = 1 + alpha;
  const a1 = -2 * cos;
  const a2 = 1 - alpha;

  let x1 = 0;
  let x2 = 0;
  let y1 = 0;
  let y2 = 0;

  for (let n = 0; n < input.length; n++) {
    const x0 = input[n];
    const y0 = (b0 / a0) * x0 + (b1 / a0) * x1 + (b2 / a0) * x2 - (a1 / a0) * y1 - (a2 / a0) * y2;
    output[n] = y0;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
  }

  return output;
}

/**
 * Inversor Espectral (Frequency Inversion Scrambler — Sistema SIGSALY)
 * Inverte a faixa espectral [0, carrierFreq]:
 * 1) Filtra passa-baixa em carrierFreq
 * 2) Modula por cos(2*pi*carrierFreq*n / fs)
 * 3) Filtra passa-baixa novamente em carrierFreq para descartar a banda de soma (2*fc)
 */
export function applyFrequencyScrambler(
  input: Float32Array,
  sampleRate: number,
  inversionFreq = 3300
): Float32Array {
  // 1. Filtragem passa-baixa para limitar a banda da voz
  const bandlimited = applyBiquadLowpass(input, sampleRate, inversionFreq);

  // 2. Modulação pela portadora da frequência de inversão
  const omega = (2 * Math.PI * inversionFreq) / sampleRate;
  const modulated = new Float32Array(input.length);
  for (let n = 0; n < input.length; n++) {
    modulated[n] = bandlimited[n] * 2 * Math.cos(omega * n);
  }

  // 3. Filtragem passa-baixa para reter apenas a banda diferença (inversão)
  return applyBiquadLowpass(modulated, sampleRate, inversionFreq);
}

/**
 * Saturação Extrema / Overdrive (Gerador de Harmônicos Ímpares)
 * y[n] = tanh(gain * x[n])
 */
export function applyOverdrive(input: Float32Array, gain = 8): Float32Array {
  const output = new Float32Array(input.length);
  const normFactor = 1 / Math.tanh(gain);

  for (let n = 0; n < input.length; n++) {
    output[n] = Math.tanh(gain * input[n]) * normFactor;
  }
  return output;
}

/**
 * Agente Anônimo (Depoimento Secreto / Comunicador Tático)
 * Combina passa-faixa estilo telefônico (400 Hz a 2400 Hz), leve modulação sub-harmônica (40 Hz)
 * e saturação suave para mascarar os formantes da fala.
 */
export function applyAgentDisguise(input: Float32Array, sampleRate: number): Float32Array {
  // Filtro passa-faixa centrado em 1200 Hz
  const filtered = applyBiquadBandpass(input, sampleRate, 1200, 0.7);

  // Modulação suave com sub-harmônico para engrossar e mascarar a voz
  const subOmega = (2 * Math.PI * 45) / sampleRate;
  const output = new Float32Array(input.length);

  for (let n = 0; n < input.length; n++) {
    const raw = filtered[n] * (0.8 + 0.3 * Math.sin(subOmega * n));
    // Soft clipping suave com arctan
    output[n] = (2 / Math.PI) * Math.atan(2.2 * raw);
  }

  return output;
}

/**
 * Aplica um efeito de disfarce vocal sobre um bloco de amostras x[n].
 */
export function processVoiceDisguise(
  input: Float32Array,
  sampleRate: number,
  effect: VoiceDisguiseType,
  params: VoiceDisguiseParams = {}
): Float32Array {
  switch (effect) {
    case 'none':
      return new Float32Array(input);
    case 'dalek':
      return applyRingModulation(input, sampleRate, params.carrierFrequency ?? 120);
    case 'bitcrush':
      return applyBitcrush(input, params.bits ?? 4, params.downsampleFactor ?? 8);
    case 'scrambler':
      return applyFrequencyScrambler(input, sampleRate, params.carrierFrequency ?? 3300);
    case 'agent':
      return applyAgentDisguise(input, sampleRate);
    case 'overdrive':
      return applyOverdrive(input, params.overdriveGain ?? 8);
    default:
      return new Float32Array(input);
  }
}

interface SpeechPhoneme {
  duration: number; // segundos
  f0: number; // frequência glótica fundamental (Hz)
  f1: number; // formante 1 (Hz)
  f2: number; // formante 2 (Hz)
  amplitude: number;
}

/**
 * Sintetiza um sinal acústico vocal ("A-GEN-TE SE-CRE-TO") usando o modelo fonte-filtro de PDS:
 * - Fonte de excitação glótica periódica rica em harmônicos com decaimento espectral de 1/h.
 * - Filtro de ressonância acústica do trato vocal (formantes F1 e F2).
 *
 * Permite demonstrar os efeitos de disfarce de voz mesmo sem microfone físico conectado.
 */
export function synthesizeSpySpeechSignal(sampleRate: number): Float32Array {
  const phonemes: SpeechPhoneme[] = [
    { duration: 0.35, f0: 125, f1: 750, f2: 1250, amplitude: 0.8 }, // "A"
    { duration: 0.40, f0: 135, f1: 500, f2: 1800, amplitude: 0.85 }, // "GEN"
    { duration: 0.35, f0: 115, f1: 450, f2: 2100, amplitude: 0.75 }, // "TE"
    { duration: 0.15, f0: 0, f1: 500, f2: 1500, amplitude: 0.05 }, // [Pausa silenciosa]
    { duration: 0.35, f0: 130, f1: 450, f2: 2100, amplitude: 0.8 }, // "SE"
    { duration: 0.35, f0: 120, f1: 500, f2: 1900, amplitude: 0.75 }, // "CRE"
    { duration: 0.45, f0: 105, f1: 500, f2: 950, amplitude: 0.85 }, // "TO"
  ];

  let totalDuration = 0;
  for (const p of phonemes) totalDuration += p.duration;

  const totalSamples = Math.floor(totalDuration * sampleRate);
  const glottalSource = new Float32Array(totalSamples);

  let currentSample = 0;
  let phase = 0;

  for (const p of phonemes) {
    const pSamples = Math.floor(p.duration * sampleRate);
    const endSample = Math.min(totalSamples, currentSample + pSamples);

    for (let n = currentSample; n < endSample; n++) {
      const localProgress = (n - currentSample) / pSamples;
      // Envelope de amplitude suave para cada sílaba (ataque e decaimento)
      const envelope = Math.sin(Math.PI * localProgress) * p.amplitude;

      if (p.f0 > 0) {
        // Fonte glótica: pulso triangular suave rico em harmônicos
        phase += (2 * Math.PI * p.f0) / sampleRate;
        if (phase > 2 * Math.PI) phase -= 2 * Math.PI;

        // Série de Fourier simplificada para a fonte glótica (1º ao 6º harmônico com roll-off)
        let s = Math.sin(phase);
        s += 0.5 * Math.sin(2 * phase);
        s += 0.33 * Math.sin(3 * phase);
        s += 0.25 * Math.sin(4 * phase);
        s += 0.15 * Math.sin(5 * phase);
        glottalSource[n] = s * envelope * 0.4;
      } else {
        // Consoante/pausa com leve sopro acústico
        glottalSource[n] = (Math.random() * 2 - 1) * envelope * 0.1;
      }
    }
    currentSample = endSample;
  }

  // Passa o sinal glótico pelos ressonadores formantes F1 e F2 de cada fonema
  const output = new Float32Array(totalSamples);
  currentSample = 0;

  for (const p of phonemes) {
    const pSamples = Math.floor(p.duration * sampleRate);
    const endSample = Math.min(totalSamples, currentSample + pSamples);
    const sliceLen = endSample - currentSample;

    if (sliceLen > 0) {
      const glottalSlice = glottalSource.subarray(currentSample, endSample);
      // Filtro de Formante 1 (F1)
      const f1Filtered = applyBiquadBandpass(glottalSlice, sampleRate, p.f1, 3.5);
      // Filtro de Formante 2 (F2)
      const f2Filtered = applyBiquadBandpass(glottalSlice, sampleRate, p.f2, 4.0);

      for (let i = 0; i < sliceLen; i++) {
        output[currentSample + i] = f1Filtered[i] * 1.5 + f2Filtered[i] * 1.0;
      }
    }
    currentSample = endSample;
  }

  // Normalização de pico para 0.8
  let peak = 0;
  for (let i = 0; i < totalSamples; i++) {
    const abs = Math.abs(output[i]);
    if (abs > peak) peak = abs;
  }
  if (peak > 0) {
    const norm = 0.8 / peak;
    for (let i = 0; i < totalSamples; i++) output[i] *= norm;
  }

  return output;
}

