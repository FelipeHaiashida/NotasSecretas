/**
 * Conteúdo Didático do Laboratório de Processamento Digital de Sinais (PDS)
 *
 * Contempla os 9 tópicos obrigatórios no Painel 5 com rigor conceitual
 * voltado para estudantes de Ciência da Computação.
 */

export interface EducationalTopic {
  id: string;
  number: number;
  title: string;
  formula?: string;
  summary: string;
  details: string;
}

export const EDUCATIONAL_TOPICS: ReadonlyArray<EducationalTopic> = [
  {
    id: 'sinal-digital',
    number: 1,
    title: 'O que é um sinal digital',
    formula: 'x[n] = x(n · Ts),  com Ts = 1 / fs',
    summary:
      'Um sinal digital é uma sequência discreta no tempo e quantizada em amplitude que representa uma grandeza física variável, como a pressão acústica de uma onda sonora.',
    details:
      'No mundo físico, o som propaga-se como uma onda mecânica contínua s(t). Para que um computador possa armazená-lo e processá-lo, o sinal contínuo é discretizado em intervalos regulares de tempo Ts = 1/fs (amostragem) e representado numericamente em ponto flutuante (como Float32Array na Web Audio API, com valores normalizados no intervalo [-1, 1]).',
  },
  {
    id: 'frequencia',
    number: 2,
    title: 'O que é frequência',
    formula: 'f = 1 / T  (em Hertz, ciclos por segundo)',
    summary:
      'A frequência indica o número de oscilações periódicas completas que uma onda realiza a cada segundo, determinando a sensação psicoacústica de altura musical (grave ou agudo).',
    details:
      'Um sinal senoidal puro s(t) = A·sen(2πft) possui período T = 1/f segundos. Na música ocidental, o padrão internacional define a nota Lá da quarta oitava (Lá4 / A4) exatamente em 440 Hz (período T ≈ 2,27 ms). Dobrar a frequência equivale a subir uma oitava inteira (por exemplo, Lá5 = 880 Hz; Lá3 = 220 Hz).',
  },
  {
    id: 'amostragem',
    number: 3,
    title: 'Como funciona a amostragem e o Teorema de Nyquist-Shannon',
    formula: 'fs > 2 · f_max   (Frequência de Nyquist: f_N = fs / 2)',
    summary:
      'Amostrar consiste em medir o valor instantâneo do sinal contínuo a uma taxa fs (em Hz). Pelo Teorema de Nyquist-Shannon, fs deve ser estritamente superior ao dobro da maior frequência presente no sinal.',
    details:
      'Em sistemas de áudio digital (tipicamente fs = 44.100 Hz ou 48.000 Hz), a frequência máxima representável sem ambiguidade é a frequência de Nyquist (fs/2 = 22.050 Hz ou 24.000 Hz), cobrindo o espectro audível humano (20 Hz a 20 kHz). Caso uma componente ultrapasse fs/2, ocorre o fenômeno de aliasing (falseamento espectral), em que frequências altas se dobram para frequências mais baixas.',
  },
  {
    id: 'dtft-dft',
    number: 4,
    title: 'O que são a DTFT e a DFT',
    formula: 'X[k] = Σ_{n=0}^{N-1} x[n] · e^(−j·2π·k·n / N),  k = 0, …, N−1',
    summary:
      'A DTFT transforma uma sequência discreta em um espectro contínuo e periódico em frequência; já a DFT amostra esse espectro em N frequências discretas igualmente espaçadas.',
    details:
      'Na prática computacional, observamos apenas um bloco finito de N amostras do sinal discreto. A Transformada Discreta de Fourier (DFT) decompõe esse bloco em N fasores complexos ortogonais de frequências ω_k = 2πk/N. A resolução em frequência entre dois bins adjacentes é dada por Δf = fs / N: aumentar o número de amostras N estreita o espaçamento entre bins e melhora a precisão espectral.',
  },
  {
    id: 'fft',
    number: 5,
    title: 'Por que utilizamos a FFT',
    formula: 'Complexidade: O(N²) → O(N · log₂ N)',
    summary:
      'A Transformada Rápida de Fourier (FFT) não é uma transformada diferente da DFT, mas sim uma família de algoritmos que calcula exatamente o mesmo resultado com custo assintótico drasticamente menor.',
    details:
      'O cálculo direto da DFT exige N² multiplicações e somas complexas: para N = 16.384 amostras, seriam necessárias 268.435.456 operações. O algoritmo Radix-2 de Cooley-Tukey explora a simetria e periodicidade dos fatores de giro W_N^(kn) = e^(−j2πkn/N) dividindo recursivamente o problema em pares e ímpares (dizimação no tempo), realizando apenas N·log₂(N) = 16.384 × 14 = 229.376 operações — uma aceleração de mais de 1.100 vezes, viabilizando análise em tempo real no navegador.',
  },
  {
    id: 'espectro',
    number: 6,
    title: 'O que representa o espectro de frequências',
    formula: '|X[k]| = √(Re(X[k])² + Im(X[k])²),   f[k] = k · fs / N',
    summary:
      'O espectro de magnitude exibe a intensidade de cada componente senoidal de frequência f[k] presente no sinal analisado.',
    details:
      'Como o sinal de áudio x[n] é puramente real, sua DFT apresenta simetria conjugada (X[N−k] = X*[k]), de modo que as magnitudes |X[k]| acima de k = N/2 espelham a primeira metade. Por isso representamos o espectro unilateral de k = 0 (componente DC, 0 Hz) até k = N/2 (frequência de Nyquist, fs/2). Um tom senoidal puro gera um único pico; já um timbre com harmônicos apresenta o pico na frequência fundamental f₀ acompanhado de picos menores em 2f₀, 3f₀, 4f₀…',
  },
  {
    id: 'identificacao-nota',
    number: 7,
    title: 'Como um computador identifica uma nota musical',
    formula: 'm = 69 + 12 · log₂(f / 440)   ⇔   f(m) = 440 · 2^((m − 69)/12)',
    summary:
      'No cenário controlado deste projeto, o algoritmo localiza o bin de maior magnitude espectral, refina a frequência por interpolação parabólica e mapeia o valor na escala temperada igual.',
    details:
      'Como a resolução discreta Δf = fs/N (cerca de 2,93 Hz a fs = 48 kHz e N = 16.384) pode cair entre dois bins vizinhos, ajustamos uma parábola pelos três pontos ao redor do máximo (k−1, k, k+1) para estimar a frequência fundamental com precisão sub-bin (erro inferior a 1 cent). Em seguida, aplicamos a equação logarítmica do temperamento igual para obter o código MIDI mais próximo. Importante: a FFT isolada funciona com alta precisão para sinais controlados onde a fundamental é dominante; gravações reais de instrumentos acústicos polifônicos ou com fundamental ausente exigem técnicas adicionais como autocorrelação (YIN), cepstrum ou produto espectral harmônico (HPS).',
  },
  {
    id: 'vazamento-espectral',
    number: 8,
    title: 'O que é vazamento espectral (Spectral Leakage)',
    formula: 'f₀ ≠ k · (fs / N)  ⇒  Energia espalha-se por múltiplos bins',
    summary:
      'O vazamento espectral ocorre quando a janela de observação de N amostras não contém um número exatamente inteiro de períodos do sinal.',
    details:
      'Recortar um trecho finito de N amostras equivale a multiplicar um sinal infinito por uma janela retangular. No domínio da frequência, essa multiplicação corresponde à convolução do espectro verdadeiro com um núcleo Dirichlet (semelhante à função sinc), que possui lóbulos laterais elevados (~ −13 dB). Se a frequência da nota não coincidir perfeitamente com um bin k·fs/N, as descontinuidades nas extremidades do bloco espalham energia por todo o espectro, elevando o piso ao redor do pico.',
  },
  {
    id: 'janela-hann',
    number: 9,
    title: 'Comparação de Janelas: Retangular, Hann, Hamming e Blackman (Janelamento ≠ Filtragem)',
    formula:
      'Hann: 0,5(1−cos(2πn/(N−1))) | Hamming: 0,54−0,46cos(2πn/(N−1)) | Blackman: 0,42−0,5cos(2πn/(N−1))+0,08cos(4πn/(N−1))',
    summary:
      'As janelas de cosseno ponderam as amostras no tempo suavizando as bordas para suprimir os lóbulos laterais do vazamento espectral, trocando resolução do lóbulo principal por atenuação lateral.',
    details:
      'Atenção conceitual: janelamento NÃO é filtragem! Enquanto um filtro atenua faixas de frequência via convolução no tempo, o janelamento multiplica o sinal no tempo (x_w[n] = x[n]·w[n]) para mitigar a descontinuidade de borda da truncagem finita antes da DFT. Na Janela Retangular, o lóbulo principal é o mais estreito (2 bins), mas o 1º lóbulo lateral está em −13,3 dB. A Janela de Hann alarga o lóbulo principal para 4 bins, mas derruba o 1º lóbulo lateral para −31,5 dB (decaimento de −18 dB/oitava). A Janela de Hamming otimiza o cancelamento do 1º lóbulo lateral (−42,7 dB), e a Janela de Blackman adiciona um termo de segundo harmônico cossenoidal (lóbulo principal de 6 bins) para atingir −58,1 dB de supressão lateral.',
  },
];
