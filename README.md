# NOTA SECRETA
### Descubra a frequência. Encontre a nota.

**NOTA SECRETA** é um jogo educativo e laboratório interativo desenvolvido para a disciplina de **Processamento Digital de Sinais (PDS)** do curso de Ciência da Computação. A aplicação demonstra na prática como um computador sintetiza sinais discretos no tempo e identifica notas musicais por meio da **Transformada Rápida de Fourier (FFT)**.

---

## 1. Objetivo Acadêmico e Enquadramento na Proposta ABP

- **Proposta Principal:** **1.3. Análise de Frequência: DTFT, DFT e FFT** (*Decomposição espectral de sinais, algoritmo Fast Fourier Transform e janelamento*).
- **Problemas Reais Resolvidos:** **Reconhecimento de Notas Musicais** e **Vazamento Espectral** (*com base de apoio em **1. Amostragem e Quantização — Teorema de Nyquist-Shannon***).
- **Metodologia:** Estruturado para **Sala de Aula Invertida e Aprendizagem Baseada em Projetos (ABP)** em 3 etapas:
  1. **Pré-Aula (Fundamentação e Modelagem):** Guia interativo com 9 tópicos fundamentais de PDS.
  2. **Simulação ABP (Laboratório FFT):** Experimentos guiados de 1 clique, comparação entre 4 janelas (**Hann, Hamming, Blackman e Retangular**), controle dinâmico do tamanho do bloco $N \in \{1.024, 2.048, 4.096, 8.192, 16.384\}$ e modo de **Microfone ao Vivo**.
  3. **Desafio Prático (10 Rodadas):** Jogo auditivo e espectral com feedback matemático real por rodada.

---

## 2. Principais Funcionalidades

- **Jogo Auditivo e Espectral (10 Rodadas por Partida):**
  - **Modo Fácil (Aprendiz Musical):** 7 notas naturais da 4ª oitava ($\text{Dó}_4$ a $\text{Si}_4$).
  - **Modo Intermediário (Explorador de Frequências):** 12 notas cromáticas com sustenidos ($\text{Dó}_4$ a $\text{Si}_4$) em um teclado virtual de piano.
  - **Modo Difícil (Mestre da FFT):** 36 notas cromáticas de $\text{Dó}_3$ ($130{,}81\text{ Hz}$) a $\text{Si}_5$ ($987{,}77\text{ Hz}$) com seletor de oitava.
  - **Pontuação e Dicas:** $100$ pontos por acerto sem dica, $60$ pontos com dica espectral, $0$ pontos por erro (máximo de $1.000$ pontos). Recordes salvos localmente via `localStorage`.
  - **Feedback Matemático Real por Rodada:** Exibe a frequência teórica, a frequência estimada pela FFT, o erro absoluto em Hz, o desvio em *cents*, o gráfico da forma de onda e o espectro de magnitude com o pico marcado.
- ** Síntese Sonora via Web Audio API:**
  - Geração matemática de amostras discretas $x[n]$ diretamente em um `AudioBuffer` (sem uso de arquivos MP3 externos).
  - Dois timbres selecionáveis: **Senoidal Puro** e **Rico em Harmônicos** ($f_0 + 2f_0 + 3f_0 + 4f_0 + 5f_0$).
- **Laboratório FFT — Entenda como o computador escuta:**
  - **Painel 1:** Visualização do sinal no domínio do tempo ($x[n]$ em função do tempo em ms).
  - **Painéis 2 e 3:** Espectro de frequências $|X[k]|$ em escala linear ou decibéis ($\text{dB}$) com comparação sobreposta entre **Janela de Hann** e **Janela Retangular**, botões para alinhar/desalinhar frequências aos bins da DFT e visualização do vazamento espectral.
  - **Painel 4:** Painel matemático em tempo real ($f_s$, $N = 16.384$, $\Delta f = f_s/N$, bin dominante $k_{\max}$, erro em Hz e em cents).
  - **Painel 5:** Guia didático interativo com 9 tópicos fundamentais de PDS.

---

## 3. Conceitos de PDS Utilizados

- Sinais em tempo contínuo $s(t)$ e tempo discreto $x[n] = A \cdot \sin(2\pi f n / f_s)$
- Período $T = 1/f$, frequência e Teorema da Amostragem de Nyquist-Shannon ($f_s > 2 f_{\max}$)
- Transformada de Fourier em Tempo Discreto (DTFT) e Transformada Discreta de Fourier (DFT)
- Transformada Rápida de Fourier (FFT) Radix-2 Cooley-Tukey por dizimação no tempo — complexidade $\mathcal{O}(N \log_2 N)$
- Espectro unilateral de magnitude $|X[k]| = \sqrt{\text{Re}(X[k])^2 + \text{Im}(X[k])^2}$ e resolução espectral $\Delta f = f_s / N$
- Janelamento no tempo ($x_w[n] = x[n] \cdot w[n]$) com Janela Retangular e Janela de Hann: $w[n] = 0{,}5 \cdot (1 - \cos(2\pi n / (N-1)))$
- Vazamento espectral (*spectral leakage*) e interpolação parabólica entre bins
- Temperamento musical igual: $f(m) = 440 \cdot 2^{(m-69)/12}$ e $m = 69 + 12 \cdot \log_2(f/440)$

---

## 4. Tecnologias

- **Vite** (Build estático rápido com `base: './'`)
- **TypeScript** (Tipagem estrita e modularização matemática)
- **HTML5 & CSS3 Moderno** (Layout responsivo, acessível, elementos nativos `<dialog>` e `<details>`, camadas `@layer`)
- **Web Audio API** (Síntese digital em `AudioBuffer` e reprodução via `AudioContext`)
- **Canvas 2D HiDPI** (Renderização da forma de onda e do espectro de frequências)
- **Vitest** (Testes automatizados unitários, matemáticos e de lógica de jogo)

---

## 5. Instruções de Instalação e Execução

### Instalar dependências

```bash
npm install
```

### Executar localmente em modo de desenvolvimento

```bash
npm run dev
```

### Executar os testes automatizados

```bash
npm run test
```

### Realizar o build de produção

```bash
npm run build
```

### Gerar o arquivo ZIP para publicação no itch.io

```bash
npm run zip
```

---

## 6. Como Publicar no itch.io

Após rodar `npm run build` e `npm run zip`, o arquivo **`nota-secreta-itchio.zip`** estará disponível na raiz do projeto contendo todo o conteúdo de `dist/` pronto para upload como projeto **HTML** no itch.io. Consulte o passo a passo detalhado em [`docs/publicacao-itchio.md`](file:///c:/Users/Felipe/Documents/Projetos/NotasSecretas/docs/publicacao-itchio.md).

---

## 7. Estrutura de Arquivos

```text
NotasSecretas/
├── docs/
│   ├── relatorio.md            # Relatório acadêmico completo de PDS
│   └── publicacao-itchio.md    # Guia passo a passo de publicação no itch.io
├── scripts/
│   └── package-itchio.mjs      # Script gerador do nota-secreta-itchio.zip
├── src/
│   ├── audio/
│   │   ├── audioEngine.ts      # Gerenciamento do AudioContext e AudioBuffer
│   │   └── synthesizer.ts      # Síntese matemática x[n] (senoidal e harmônico)
│   ├── components/
│   │   └── educationalContent.ts # Conteúdo didático dos 9 tópicos de PDS
│   ├── dsp/
│   │   ├── fft.ts              # FFT Radix-2 Cooley-Tukey e DFT direta
│   │   ├── windows.ts          # Janelas Retangular e de Hann
│   │   ├── spectrum.ts         # Cálculo de magnitude, dB e bins de frequência
│   │   └── pitchDetection.ts   # Detecção de pico e interpolação parabólica
│   ├── game/
│   │   ├── gameLogic.ts        # Regras da partida, dificuldades, sorteio e dicas
│   │   └── scoring.ts          # Cálculo de pontuação e avaliação de desempenho
│   ├── music/
│   │   └── notes.ts            # Escala temperada, conversão MIDI/Hz e erros
│   ├── styles/
│   │   └── main.css            # Estilização moderna, responsiva e acessível
│   ├── utils/
│   │   ├── format.ts           # Formatação numérica pt-BR
│   │   └── storage.ts          # Persistência de recordes em localStorage
│   ├── visualization/
│   │   ├── waveform.ts         # Gráfico Canvas 2D do domínio do tempo
│   │   └── spectrumChart.ts    # Gráfico Canvas 2D do espectro da FFT
│   └── main.ts                 # Controlador principal da aplicação
├── tests/
│   ├── dsp.test.ts             # Testes matemáticos (MIDI, FFT, Hann, Detecção)
│   └── game.test.ts            # Testes de regras do jogo, dicas e pontuação
├── index.html
├── package.json
├── tsconfig.json
└── vite.config.ts
```

---

## 8. Explicação Breve da FFT no Projeto

Para cada nota reproduzida (com $f_s = 48.000\text{ Hz}$ ou $44.100\text{ Hz}$), o sistema extrai um segmento estacionário de $N = 16.384$ amostras, multiplica-o pela janela $w[n]$ escolhida e executa a FFT Radix-2 Cooley-Tukey *in-place*. A partir das magnitudes $|X[k]|$, localiza-se o bin dominante $k_{\max}$ e aplica-se interpolação parabólica nos três bins vizinhos $(k_{\max}-1, k_{\max}, k_{\max}+1)$, alcançando precisão sub-bin com erro inferior a $0{,}6\text{ cent}$ em toda a extensão de $\text{Dó}_3$ a $\text{Si}_5$.

---

## 9. Limitações Conhecidas

- O detector de frequência fundamental por pico espectral da FFT foi projetado e validado para sinais monofônicos controlados nos quais a frequência fundamental possui amplitude superior aos harmônicos superiores.
- Para análise de gravações acústicas polifônicas reais, instrumentos com fundamental suprimida (*missing fundamental*) ou ambientes com forte ruído de fundo, a FFT isolada não é suficiente, sendo necessário combiná-la com algoritmos como autocorrelação (YIN), cepstrum ou Produto Espectral Harmônico (HPS).
- Devido às políticas de segurança dos navegadores (*Autoplay Policy*), a reprodução de áudio requer sempre um clique ou toque inicial do usuário.
