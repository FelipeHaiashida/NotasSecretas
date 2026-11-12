/**
 * Ponto de Entrada e Controlador Principal da Interface — NOTA SECRETA
 *
 * Conecta o motor de áudio (Web Audio API), o motor matemático de PDS (FFT Radix-2,
 * Janelamento de Hann/Retangular, Interpolação Parabólica), a lógica de jogo de 10 rodadas
 * e o Laboratório FFT interativo com experimentos guiados.
 */

import { AudioEngine } from './audio/audioEngine';
import { SynthesizedSignal, synthesizeNoteSamples, TimbreType } from './audio/synthesizer';
import { EDUCATIONAL_TOPICS } from './components/educationalContent';
import { DEFAULT_FFT_SIZE, detectPitchFromSamples, PitchDetectionResult } from './dsp/pitchDetection';
import { analyzeSpectrum, binToFrequency, extractStableSegment } from './dsp/spectrum';
import { getWindowMetadata, WindowType } from './dsp/windows';
import {
  advanceToNextRound,
  createMatchState,
  DIFFICULTY_CONFIGS,
  DifficultyLevel,
  MatchState,
  requestHintInMatch,
  submitRoundAnswer,
} from './game/gameLogic';
import { getPerformanceEvaluation, MAX_MATCH_SCORE } from './game/scoring';
import {
  calculateAbsoluteErrorHz,
  calculateCentsError,
  getHardModeNotes,
  getIntermediateModeNotes,
  MusicalNote,
} from './music/notes';
import { formatCents, formatHz, formatNumberPtBr } from './utils/format';
import {
  loadHighScores,
  loadPreferences,
  saveHighScore,
  savePreferences,
} from './utils/storage';
import { renderSpectrumCanvas } from './visualization/spectrumChart';
import { renderWaveformCanvas } from './visualization/waveform';

type ActiveView = 'home' | 'game' | 'results' | 'lab' | 'theory';
type LabExperimentId = 'exact' | 'leakage' | 'harmonics' | 'resolution' | 'custom';

class NotaSecretaApp {
  private audioEngine = new AudioEngine();
  private prefs = loadPreferences();
  private highScores = loadHighScores();

  private activeView: ActiveView = 'home';
  private matchState: MatchState | null = null;
  private selectedNoteMidi: number | null = null;
  private selectedHardOctave = 4;

  /** Último sinal sintetizado na rodada atual (usado para reprodução e análise FFT) */
  private currentRoundSignal: SynthesizedSignal | null = null;
  private heroAnimFrame: number | null = null;
  private labMicAnimFrame: number | null = null;
  private reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Estado do Laboratório FFT
  private labFrequency = 440;
  private labFftSize = DEFAULT_FFT_SIZE;
  private labTimbre: TimbreType = 'sine';
  private labWindow: WindowType = 'hann';
  private labCompareWindows: 'both' | 'single' = 'both';
  private labZoomMode: 'around-peak' | 'band-1200' | 'band-3000' = 'around-peak';
  private labScaleMode: 'db' | 'linear' = 'db';
  private labTimeSpanMs = 20;
  private labShowWindowEnv = true;
  private activeLabExperiment: LabExperimentId = 'leakage';

  public init(): void {
    this.setupDialogLightDismissFallback();
    this.setupScrollHeaderFallback();
    this.setupRangeProgressFallback();
    this.applySavedPreferences();
    this.renderHighScores();
    this.populateEducationalAccordion();
    this.populateLabPresets();
    this.bindEvents();
    this.startHeroWaveAnimation();
    this.updateLabSimulation();
  }

  /**
   * Fallback de preenchimento dinâmico para inputs range em navegadores sem suporte a accent-color.
   */
  private setupRangeProgressFallback(): void {
    if (typeof CSS !== 'undefined' && !CSS.supports('accent-color', '#22d3ee')) {
      const updateSliderProgress = (slider: HTMLInputElement) => {
        const min = Number(slider.min) || 0;
        const max = Number(slider.max) || 100;
        const val = Number(slider.value) || 0;
        const pct = Math.max(0, Math.min(100, ((val - min) / (max - min)) * 100));
        slider.style.setProperty('--progress', `${pct}%`);
      };
      document.querySelectorAll<HTMLInputElement>('input[type="range"]').forEach((slider) => {
        updateSliderProgress(slider);
        slider.addEventListener('input', () => updateSliderProgress(slider));
      });
    }
  }

  /**
   * Fallback para ocultar cabeçalho ao rolar para baixo caso scroll-state queries não sejam suportadas.
   */
  private setupScrollHeaderFallback(): void {
    if (typeof CSS !== 'undefined' && !CSS.supports('container-type', 'scroll-state')) {
      const bar = document.querySelector<HTMLElement>('.site-header');
      let lastY = window.scrollY;
      window.addEventListener(
        'scroll',
        () => {
          const y = Math.max(
            0,
            Math.min(
              window.scrollY,
              document.documentElement.scrollHeight - window.innerHeight
            )
          );
          if (y === lastY) return;
          bar?.classList.toggle('is-hidden', y > lastY && y > (bar?.offsetHeight ?? 60));
          lastY = y;
        },
        { passive: true }
      );
    }
  }

  /**
   * Fallback de light-dismiss para navegadores sem suporte nativo a <dialog closedby="any">.
   */
  private setupDialogLightDismissFallback(): void {
    if (!('closedBy' in HTMLDialogElement.prototype)) {
      const outside = (e: PointerEvent, dialog: HTMLDialogElement) => {
        const r = dialog.getBoundingClientRect();
        return (
          e.clientX < r.left ||
          e.clientX > r.right ||
          e.clientY < r.top ||
          e.clientY > r.bottom
        );
      };
      const dialogs = document.querySelectorAll<HTMLDialogElement>('dialog[closedby="any"]');
      dialogs.forEach((dialog) => {
        let pressedOutside = false;
        dialog.addEventListener('pointerdown', (e) => {
          pressedOutside = outside(e, dialog);
        });
        dialog.addEventListener('pointerup', (e) => {
          if (pressedOutside && outside(e, dialog)) {
            dialog.close();
          }
        });
      });
    }
  }

  private applySavedPreferences(): void {
    this.audioEngine.setVolume(this.prefs.volume);
    const volSlider = document.getElementById('global-volume-slider') as HTMLInputElement | null;
    const volVal = document.getElementById('global-volume-value');
    if (volSlider && volVal) {
      const pct = Math.round(this.prefs.volume * 100);
      volSlider.value = String(pct);
      volVal.textContent = `${pct}%`;
    }

    const timbreSel = document.getElementById('game-timbre-select') as HTMLSelectElement | null;
    if (timbreSel) timbreSel.value = this.prefs.timbre;

    const winSel = document.getElementById('game-window-select') as HTMLSelectElement | null;
    if (winSel) winSel.value = this.prefs.windowType;

    this.selectDifficultyCard(this.prefs.difficulty);
  }

  private renderHighScores(): void {
    this.highScores = loadHighScores();
    const easyEl = document.getElementById('record-easy');
    const interEl = document.getElementById('record-intermediate');
    const hardEl = document.getElementById('record-hard');
    if (easyEl) easyEl.textContent = `Recorde: ${this.highScores.easy} pts`;
    if (interEl) interEl.textContent = `Recorde: ${this.highScores.intermediate} pts`;
    if (hardEl) hardEl.textContent = `Recorde: ${this.highScores.hard} pts`;
  }

  private selectDifficultyCard(difficulty: DifficultyLevel): void {
    this.prefs = savePreferences({ difficulty });
    const cards = document.querySelectorAll<HTMLButtonElement>('.difficulty-card');
    cards.forEach((card) => {
      const isMatch = card.dataset.difficulty === difficulty;
      card.classList.toggle('selected', isMatch);
      card.setAttribute('aria-pressed', isMatch ? 'true' : 'false');
    });
  }

  private announceToScreenReader(message: string): void {
    const announcer = document.getElementById('sr-announcer');
    if (announcer) {
      announcer.textContent = message;
    }
  }

  private switchView(view: ActiveView): void {
    this.activeView = view;
    this.audioEngine.stopPlayback();
    if (view !== 'lab' && this.audioEngine.isMicrophoneActive()) {
      this.stopLabMicrophoneMode();
    }

    const views: Record<ActiveView, HTMLElement | null> = {
      home: document.getElementById('view-home'),
      game: document.getElementById('view-game'),
      results: document.getElementById('view-results'),
      lab: document.getElementById('view-lab'),
      theory: document.getElementById('view-theory'),
    };

    (Object.keys(views) as ActiveView[]).forEach((k) => {
      const el = views[k];
      if (el) {
        el.hidden = k !== view;
      }
    });

    // Cada tela começa do topo: sem isso o conteúdo novo pode abrir fora da área visível
    window.scrollTo(0, 0);

    const navHome = document.getElementById('nav-btn-home');
    const navGame = document.getElementById('nav-btn-game');
    const navLab = document.getElementById('nav-btn-lab');
    const navTheory = document.getElementById('nav-btn-theory');

    navHome?.removeAttribute('aria-current');
    navGame?.removeAttribute('aria-current');
    navLab?.removeAttribute('aria-current');
    navTheory?.removeAttribute('aria-current');

    if (view === 'theory') {
      navTheory?.setAttribute('aria-current', 'page');
      document.title = 'Teoria de PDS | NOTA SECRETA';
    } else if (view === 'home') {
      navHome?.setAttribute('aria-current', 'page');
      document.title = 'NOTA SECRETA | Descubra a frequência. Encontre a nota.';
      this.renderHighScores();
    } else if (view === 'game' || view === 'results') {
      navGame?.setAttribute('aria-current', 'page');
      document.title = 'Em Partida | NOTA SECRETA';
    } else if (view === 'lab') {
      navLab?.setAttribute('aria-current', 'page');
      document.title = 'Laboratório FFT | NOTA SECRETA';
      requestAnimationFrame(() => this.updateLabSimulation());
    }
  }

  private bindEvents(): void {
    // Navegação do cabeçalho
    document.getElementById('btn-brand-home')?.addEventListener('click', () => {
      this.switchView('home');
    });
    document.getElementById('nav-btn-home')?.addEventListener('click', () => {
      this.switchView('home');
    });
    document.getElementById('nav-btn-game')?.addEventListener('click', () => {
      if (!this.matchState || this.matchState.matchFinished) {
        this.startNewMatch();
      } else {
        this.switchView('game');
      }
    });
    document.getElementById('nav-btn-lab')?.addEventListener('click', () => {
      this.switchView('lab');
    });

    // Modal "Como Jogar"
    const howtoDialog = document.getElementById('howto-dialog') as HTMLDialogElement | null;
    const openHowto = () => {
      if (howtoDialog) {
        howtoDialog.showModal();
      }
    };
    document.getElementById('nav-btn-howto')?.addEventListener('click', openHowto);
    document.getElementById('btn-open-howto')?.addEventListener('click', openHowto);
    howtoDialog?.addEventListener('close', () => {
      howtoDialog.returnValue = '';
    });

    // Controle de volume
    const volSlider = document.getElementById('global-volume-slider') as HTMLInputElement | null;
    const volVal = document.getElementById('global-volume-value');
    volSlider?.addEventListener('input', () => {
      const pct = Number(volSlider.value);
      const norm = pct / 100;
      this.audioEngine.setVolume(norm);
      this.prefs = savePreferences({ volume: norm });
      if (volVal) volVal.textContent = `${pct}%`;
    });

    // Seleção de dificuldade
    document.querySelectorAll<HTMLButtonElement>('.difficulty-card').forEach((card) => {
      card.addEventListener('click', () => {
        const diff = card.dataset.difficulty as DifficultyLevel | undefined;
        if (diff) {
          this.selectDifficultyCard(diff);
        }
      });
    });

    // Opções de timbre e janela na Home
    const gameTimbre = document.getElementById('game-timbre-select') as HTMLSelectElement | null;
    gameTimbre?.addEventListener('change', () => {
      this.prefs = savePreferences({ timbre: gameTimbre.value as TimbreType });
    });

    const gameWindow = document.getElementById('game-window-select') as HTMLSelectElement | null;
    gameWindow?.addEventListener('change', () => {
      this.prefs = savePreferences({ windowType: gameWindow.value as WindowType });
    });

    // Botões de ação da Home e Roteiro de Sala de Aula Invertida & ABP
    document.getElementById('btn-start-game')?.addEventListener('click', () => {
      this.startNewMatch();
    });
    document.getElementById('btn-open-lab')?.addEventListener('click', () => {
      this.switchView('lab');
    });
    document.getElementById('btn-trail-theory')?.addEventListener('click', () => {
      this.switchView('theory');
    });
    document.getElementById('nav-btn-theory')?.addEventListener('click', () => {
      this.switchView('theory');
    });
    document.getElementById('btn-trail-lab')?.addEventListener('click', () => {
      this.switchView('lab');
    });
    document.getElementById('btn-trail-game')?.addEventListener('click', () => {
      this.startNewMatch();
    });

    // Botões da Tela de Jogo
    document.getElementById('btn-play-note')?.addEventListener('click', () => {
      void this.playCurrentRoundNote();
    });
    document.getElementById('btn-replay-note')?.addEventListener('click', () => {
      void this.playCurrentRoundNote();
    });
    document.getElementById('btn-play-ref-c4')?.addEventListener('click', () => {
      void this.playReferenceNoteC4();
    });
    document.getElementById('btn-feedback-replay')?.addEventListener('click', () => {
      void this.playCurrentRoundNote();
    });
    document.getElementById('btn-request-hint')?.addEventListener('click', () => {
      this.handleRequestHint();
    });
    document.getElementById('btn-confirm-answer')?.addEventListener('click', () => {
      this.handleConfirmAnswer();
    });
    document.getElementById('btn-next-round')?.addEventListener('click', () => {
      this.handleNextRound();
    });

    // Seletor de oitava no Modo Difícil
    document.querySelectorAll<HTMLButtonElement>('.octave-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const oct = Number(btn.dataset.octave);
        if (oct >= 3 && oct <= 5) {
          this.selectedHardOctave = oct;
          document.querySelectorAll<HTMLButtonElement>('.octave-btn').forEach((b) => {
            const active = Number(b.dataset.octave) === oct;
            b.classList.toggle('active', active);
            b.setAttribute('aria-pressed', active ? 'true' : 'false');
          });
          this.renderNoteSelectionControls();
        }
      });
    });

    // Botões da Tela de Resultados
    document.getElementById('btn-play-again')?.addEventListener('click', () => {
      this.startNewMatch();
    });
    document.getElementById('btn-results-to-lab')?.addEventListener('click', () => {
      this.switchView('lab');
    });
    document.getElementById('btn-results-home')?.addEventListener('click', () => {
      this.switchView('home');
    });

    // Controles do Laboratório FFT
    this.bindLabEvents();

    // Redimensionamento responsivo dos gráficos Canvas
    window.addEventListener('resize', () => {
      if (this.activeView === 'lab') {
        this.updateLabSimulation();
      } else if (this.activeView === 'game' && this.currentRoundSignal) {
        this.renderLiveRoundWave(this.currentRoundSignal);
      }
    });
  }

  // =========================================================================
  // ANIMAÇÃO DA TELA INICIAL (ONDAS SONORAS)
  // =========================================================================
  private startHeroWaveAnimation(): void {
    const canvas = document.getElementById('hero-wave-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let phase = 0;

    const drawFrame = () => {
      if (this.activeView === 'home') {
        const dpr = window.devicePixelRatio || 1;
        const w = Math.max(300, canvas.clientWidth || 760);
        const h = 110;

        if (canvas.width !== Math.round(w * dpr) || canvas.height !== Math.round(h * dpr)) {
          canvas.width = Math.round(w * dpr);
          canvas.height = Math.round(h * dpr);
        }

        ctx.save();
        ctx.scale(dpr, dpr);
        ctx.fillStyle = '#090d1a';
        ctx.fillRect(0, 0, w, h);

        const midY = h / 2;
        const waves = [
          { freq: 2.0, amp: 0.36, color: '#22d3ee', speed: 1.0, width: 2.2 },
          { freq: 4.0, amp: 0.17, color: '#a855f7', speed: -1.4, width: 1.6 },
          { freq: 6.0, amp: 0.09, color: '#38bdf8', speed: 2.1, width: 1.2 },
        ];

        for (const wave of waves) {
          ctx.beginPath();
          ctx.strokeStyle = wave.color;
          ctx.lineWidth = wave.width;
          for (let x = 0; x <= w; x += 3) {
            const normX = x / w;
            const envelope = Math.sin(Math.PI * normX);
            const y =
              midY -
              Math.sin(normX * Math.PI * 2 * wave.freq + phase * wave.speed) *
                (h * wave.amp) *
                envelope;
            if (x === 0) ctx.moveTo(x, y);
            else ctx.lineTo(x, y);
          }
          ctx.stroke();
        }
        ctx.restore();

        if (!this.reducedMotion) {
          phase += 0.035;
        }
      }

      if (!this.reducedMotion) {
        this.heroAnimFrame = requestAnimationFrame(drawFrame);
      }
    };

    if (this.heroAnimFrame !== null) {
      cancelAnimationFrame(this.heroAnimFrame);
    }
    drawFrame();
  }

  // =========================================================================
  // FLUXO DO JOGO (10 RODADAS)
  // =========================================================================
  private startNewMatch(): void {
    this.matchState = createMatchState(this.prefs.difficulty);
    this.selectedHardOctave = 4;
    this.switchView('game');
    this.prepareCurrentRoundUI();
  }

  private prepareCurrentRoundUI(): void {
    if (!this.matchState) return;

    this.selectedNoteMidi = null;
    this.currentRoundSignal = null;

    // Atualiza HUD
    const hudRound = document.getElementById('hud-round');
    const hudScore = document.getElementById('hud-score');
    const hudDiff = document.getElementById('hud-difficulty');
    const progressBar = document.getElementById(
      'round-progress-bar'
    ) as HTMLProgressElement | null;

    if (hudRound) {
      hudRound.textContent = `${this.matchState.currentRound} / ${this.matchState.totalRounds}`;
    }
    if (hudScore) {
      hudScore.textContent = String(this.matchState.score);
    }
    if (hudDiff) {
      hudDiff.textContent =
        DIFFICULTY_CONFIGS[this.matchState.difficulty].title.split('—')[1]?.trim() ?? '';
    }
    if (progressBar) {
      progressBar.value = this.matchState.currentRound;
      progressBar.max = this.matchState.totalRounds;
    }

    // Exibe a etapa de pergunta/escuta e esconde o painel de análise pós-resposta
    const questionStage = document.getElementById('round-question-stage');
    if (questionStage) questionStage.hidden = false;

    const feedbackPanel = document.getElementById('round-feedback-panel');
    if (feedbackPanel) feedbackPanel.hidden = true;

    const hintBanner = document.getElementById('hint-banner');
    if (hintBanner) hintBanner.hidden = true;

    const playBtnLabel = document.getElementById('btn-play-note-label');
    if (playBtnLabel) playBtnLabel.textContent = 'Ouvir nota';

    const replayBtn = document.getElementById('btn-replay-note') as HTMLButtonElement | null;
    if (replayBtn) replayBtn.disabled = true;

    const hintBtn = document.getElementById('btn-request-hint') as HTMLButtonElement | null;
    if (hintBtn) hintBtn.disabled = false;

    const confirmBtn = document.getElementById('btn-confirm-answer') as HTMLButtonElement | null;
    if (confirmBtn) confirmBtn.disabled = true;

    const previewEl = document.getElementById('selected-note-preview');
    if (previewEl) {
      previewEl.textContent = 'Selecione uma nota acima para habilitar a confirmação';
    }

    const statusBadge = document.getElementById('wave-status-badge');
    if (statusBadge) {
      statusBadge.textContent = 'Sintetizando a nota secreta...';
    }

    // Seletor de oitava apenas no modo difícil
    const octaveBar = document.getElementById('octave-selector-bar');
    if (octaveBar) {
      octaveBar.hidden = this.matchState.difficulty !== 'hard';
    }

    this.renderIdleLiveWave();
    this.renderNoteSelectionControls();

    // A rodada começa já tocando a nota: evita responder sem ouvir e poupa um clique
    window.scrollTo(0, 0);
    void this.playCurrentRoundNote();
  }

  private renderIdleLiveWave(): void {
    const canvas = document.getElementById('game-live-wave-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    const flatSamples = new Float32Array(1024);
    renderWaveformCanvas(canvas, {
      samples: flatSamples,
      sampleRate: 48000,
      timeWindowMs: 15,
      strokeColor: '#334155',
      label: 'Aguardando reprodução sonora...',
    });
  }

  private renderLiveRoundWave(signal: SynthesizedSignal): void {
    const canvas = document.getElementById('game-live-wave-canvas') as HTMLCanvasElement | null;
    if (!canvas) return;
    renderWaveformCanvas(canvas, {
      samples: signal.samples,
      sampleRate: signal.sampleRate,
      timeWindowMs: 15,
      strokeColor: '#22d3ee',
      label: `Sinal sintetizado (${
        signal.timbre === 'sine' ? 'Senoidal Puro' : 'Com Harmônicos'
      })`,
    });
  }

  private async playCurrentRoundNote(): Promise<void> {
    if (!this.matchState) return;
    const targetFreq = this.matchState.targetNote.frequency;

    try {
      const statusBadge = document.getElementById('wave-status-badge');
      if (statusBadge) {
        statusBadge.textContent = 'Reproduzindo sinal sintetizado...';
      }

      const signal = await this.audioEngine.synthesizeAndPlay(
        targetFreq,
        this.prefs.timbre,
        1.2,
        () => {
          if (statusBadge) {
            statusBadge.textContent =
              'Sinal reproduzido. Escolha a nota correspondente ou clique em "Repetir som".';
          }
        }
      );

      this.currentRoundSignal = signal;
      this.renderLiveRoundWave(signal);

      const replayBtn = document.getElementById('btn-replay-note') as HTMLButtonElement | null;
      if (replayBtn) replayBtn.disabled = false;

      const confirmBtn = document.getElementById('btn-confirm-answer') as HTMLButtonElement | null;
      if (confirmBtn && this.selectedNoteMidi !== null && !this.matchState.roundAnswered) {
        confirmBtn.disabled = false;
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao iniciar o áudio.';
      this.announceToScreenReader(msg);
    }
  }

  private async playReferenceNoteC4(): Promise<void> {
    try {
      const statusBadge = document.getElementById('wave-status-badge');
      if (statusBadge) {
        statusBadge.textContent = '🎹 Ouvindo referência: Dó4 (261,63 Hz)...';
      }
      await this.audioEngine.synthesizeAndPlay(261.625565, this.prefs.timbre, 0.85, () => {
        if (statusBadge) {
          statusBadge.textContent =
            'Referência Dó4 (261,63 Hz) reproduzida. Compare com a nota secreta!';
        }
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Falha ao reproduzir referência.';
      this.announceToScreenReader(msg);
    }
  }

  private renderNoteSelectionControls(): void {
    if (!this.matchState) return;
    const container = document.getElementById('note-options-container');
    if (!container) return;
    container.innerHTML = '';

    const isAnswered = this.matchState.roundAnswered;
    const isEasyMode = this.matchState.difficulty === 'easy';
    const activeOctave =
      this.matchState.difficulty === 'hard' ? this.selectedHardOctave : 4;

    // Obtém todas as 12 notas da oitava ativa para montar o pianinho completo (7 teclas brancas + 5 pretas)
    const allOctaveNotes =
      this.matchState.difficulty === 'hard'
        ? this.matchState.availableNotes.filter((n) => n.octave === activeOctave)
        : getIntermediateModeNotes();

    const whiteNotes = allOctaveNotes.filter((n) => !n.isSharp);
    const blackNotes = allOctaveNotes.filter((n) => n.isSharp);

    const keyboard = document.createElement('div');
    keyboard.className = 'piano-keyboard';

    const octaveBed = document.createElement('div');
    octaveBed.className = 'piano-octave-bed';

    const whiteKeysRow = document.createElement('div');
    whiteKeysRow.className = 'piano-white-keys';

    const degreeLabels = ['1º', '2º', '3º', '4º', '5º', '6º', '7º'];

    whiteNotes.forEach((note, idx) => {
      const keyBtn = document.createElement('button');
      keyBtn.type = 'button';
      keyBtn.className = 'piano-key natural-key';
      keyBtn.disabled = isAnswered;
      if (this.selectedNoteMidi === note.midi) {
        keyBtn.classList.add('selected');
      }
      keyBtn.setAttribute(
        'aria-pressed',
        this.selectedNoteMidi === note.midi ? 'true' : 'false'
      );
      keyBtn.setAttribute('aria-label', `Tecla branca ${note.fullName}`);

      const degSpan = document.createElement('span');
      degSpan.className = 'key-degree';
      degSpan.textContent = `${degreeLabels[idx] ?? ''} grau`;

      const nameSpan = document.createElement('span');
      nameSpan.className = 'key-name';
      nameSpan.textContent = note.name;

      const octSpan = document.createElement('span');
      octSpan.className = 'key-octave';
      octSpan.textContent = note.fullName;

      keyBtn.appendChild(degSpan);
      keyBtn.appendChild(nameSpan);
      keyBtn.appendChild(octSpan);

      keyBtn.addEventListener('click', () => {
        this.handleSelectNoteOption(note);
      });

      whiteKeysRow.appendChild(keyBtn);
    });

    const blackKeysLayer = document.createElement('div');
    blackKeysLayer.className = 'piano-black-keys';

    for (const note of blackNotes) {
      const semitoneInOctave = ((note.midi % 12) + 12) % 12; // 1 (Dó♯), 3 (Ré♯), 6 (Fá♯), 8 (Sol♯), 10 (Lá♯)
      const keyBtn = document.createElement('button');
      keyBtn.type = 'button';
      keyBtn.dataset.semitone = String(semitoneInOctave);

      if (isEasyMode) {
        // No Modo Fácil (apenas notas naturais), mostra as teclas pretas no piano como referência visual desativada
        keyBtn.className = 'piano-key sharp-key sharp-key-inactive';
        keyBtn.disabled = true;
        keyBtn.tabIndex = -1;
        keyBtn.setAttribute('aria-hidden', 'true');
      } else {
        keyBtn.className = 'piano-key sharp-key';
        keyBtn.disabled = isAnswered;
        if (this.selectedNoteMidi === note.midi) {
          keyBtn.classList.add('selected');
        }
        keyBtn.setAttribute(
          'aria-pressed',
          this.selectedNoteMidi === note.midi ? 'true' : 'false'
        );
        keyBtn.setAttribute('aria-label', `Tecla preta ${note.fullName}`);
        keyBtn.addEventListener('click', () => {
          this.handleSelectNoteOption(note);
        });
      }

      const nameSpan = document.createElement('span');
      nameSpan.className = 'key-name';
      nameSpan.textContent = note.name;

      const octSpan = document.createElement('span');
      octSpan.className = 'key-octave';
      octSpan.textContent = isEasyMode ? '—' : String(note.octave);

      keyBtn.appendChild(nameSpan);
      keyBtn.appendChild(octSpan);

      blackKeysLayer.appendChild(keyBtn);
    }

    octaveBed.appendChild(whiteKeysRow);
    octaveBed.appendChild(blackKeysLayer);
    keyboard.appendChild(octaveBed);
    container.appendChild(keyboard);
  }

  private handleSelectNoteOption(note: MusicalNote): void {
    if (!this.matchState || this.matchState.roundAnswered) return;
    this.selectedNoteMidi = note.midi;

    const previewEl = document.getElementById('selected-note-preview');
    if (previewEl) {
      previewEl.innerHTML = `Sua escolha no piano: <strong class="highlight-cyan">${note.fullName}</strong>`;
    }

    // Só libera a confirmação depois que a nota secreta foi ouvida ao menos uma vez
    const confirmBtn = document.getElementById('btn-confirm-answer') as HTMLButtonElement | null;
    if (confirmBtn) {
      confirmBtn.disabled = this.currentRoundSignal === null;
    }

    // Ouvir a tecla permite comparar de ouvido, então conta como dica na rodada
    const previewCheckbox = document.getElementById(
      'game-piano-preview-sound'
    ) as HTMLInputElement | null;
    if (previewCheckbox?.checked) {
      this.matchState = { ...this.matchState, usedHintInCurrentRound: true };
      void this.audioEngine.synthesizeAndPlay(note.frequency, this.prefs.timbre, 0.55);
    }

    this.renderNoteSelectionControls();
  }

  private handleRequestHint(): void {
    if (!this.matchState || this.matchState.roundAnswered) return;
    const fs = this.audioEngine.getSampleRate();
    this.matchState = requestHintInMatch(this.matchState, fs, DEFAULT_FFT_SIZE);

    const hintBanner = document.getElementById('hint-banner');
    const hintText = document.getElementById('hint-text');
    if (hintBanner && hintText && this.matchState.currentHintText) {
      hintText.textContent = this.matchState.currentHintText;
      hintBanner.hidden = false;
      this.announceToScreenReader(`Dica ativada: ${this.matchState.currentHintText}`);
    }

    const hintBtn = document.getElementById('btn-request-hint') as HTMLButtonElement | null;
    if (hintBtn) {
      hintBtn.disabled = true;
    }
  }

  private handleConfirmAnswer(): void {
    if (!this.matchState || this.selectedNoteMidi === null || this.matchState.roundAnswered) {
      return;
    }

    // Garante que temos as amostras discretas sintetizadas da nota da rodada para a análise FFT real
    const fs = this.currentRoundSignal?.sampleRate ?? this.audioEngine.getSampleRate();
    const signal =
      this.currentRoundSignal ??
      synthesizeNoteSamples({
        frequency: this.matchState.targetNote.frequency,
        sampleRate: fs,
        durationSeconds: 1.2,
        timbre: this.prefs.timbre,
      });
    this.currentRoundSignal = signal;

    // Executa o cálculo real da FFT sobre o buffer sintetizado
    const pitchResult = detectPitchFromSamples(signal.samples, signal.sampleRate, {
      fftSize: DEFAULT_FFT_SIZE,
      windowType: this.prefs.windowType,
      theoreticalFrequency: this.matchState.targetNote.frequency,
    });

    if (!pitchResult.success) {
      const statusBadge = document.getElementById('wave-status-badge');
      if (statusBadge) {
        statusBadge.textContent =
          pitchResult.errorMessage ?? 'Erro ao processar FFT. Tente ouvir e confirmar novamente.';
      }
      return;
    }

    const { nextState, roundRecord } = submitRoundAnswer(
      this.matchState,
      this.selectedNoteMidi,
      pitchResult,
      this.prefs.timbre
    );
    this.matchState = nextState;

    const hudScore = document.getElementById('hud-score');
    const scoreContainer = document.getElementById('hud-score-container');
    if (hudScore) {
      hudScore.textContent = String(this.matchState.score);
    }
    if (roundRecord.isCorrect && scoreContainer) {
      scoreContainer.classList.remove('score-pulse');
      void scoreContainer.offsetWidth;
      scoreContainer.classList.add('score-pulse');
    }

    this.renderRoundFeedback(roundRecord, signal, pitchResult);
  }

  private renderRoundFeedback(
    roundRecord: ReturnType<typeof submitRoundAnswer>['roundRecord'],
    signal: SynthesizedSignal,
    pitchResult: PitchDetectionResult
  ): void {
    // Oculta a etapa de pergunta/teclado para focar 100% na análise didática sem empilhar gráficos
    const questionStage = document.getElementById('round-question-stage');
    if (questionStage) questionStage.hidden = true;

    const feedbackPanel = document.getElementById('round-feedback-panel');
    const banner = document.getElementById('feedback-header-banner');
    const icon = document.getElementById('feedback-icon');
    const title = document.getElementById('feedback-title');
    const points = document.getElementById('feedback-points');
    const nextBtn = document.getElementById('btn-next-round');

    if (feedbackPanel) feedbackPanel.hidden = false;

    // O resultado substitui o piano: volta ao topo e deixa "Próxima rodada" pronta no Enter
    window.scrollTo(0, 0);
    nextBtn?.focus({ preventScroll: true });

    if (banner) {
      banner.classList.toggle('is-correct', roundRecord.isCorrect);
      banner.classList.toggle('is-wrong', !roundRecord.isCorrect);
    }
    if (icon) {
      icon.textContent = roundRecord.isCorrect ? '✓' : '✗';
    }
    if (title) {
      title.textContent = roundRecord.isCorrect
        ? `Você acertou! É a nota ${roundRecord.targetNote.fullName}.`
        : `Quase! A nota sorteada era ${roundRecord.targetNote.fullName}.`;
    }
    if (points) {
      points.textContent = roundRecord.isCorrect
        ? `+${roundRecord.pointsEarned} pontos adicionados ${
            roundRecord.usedHint ? '(com uso de dica)' : '(sem dica!)'
          }`
        : `Você escolheu ${roundRecord.selectedNote.fullName} (${formatHz(
            roundRecord.selectedNote.frequency
          )}). Veja abaixo como a FFT identificou a nota real.`;
    }
    if (nextBtn && this.matchState) {
      nextBtn.textContent =
        this.matchState.currentRound >= this.matchState.totalRounds
          ? 'Ver Resultado Final →'
          : 'Próxima rodada →';
    }

    // Preenche métricas matemáticas agrupadas
    const setMetric = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setMetric(
      'fb-target-note',
      `${roundRecord.targetNote.fullName} (MIDI ${roundRecord.targetNote.midi})`
    );
    const selEl = document.getElementById('fb-selected-note');
    if (selEl) {
      selEl.textContent = `${roundRecord.selectedNote.fullName} (${
        roundRecord.isCorrect ? 'Correto ✓' : 'Incorreto ✗'
      })`;
      selEl.className = `metric-value ${
        roundRecord.isCorrect ? 'text-success' : 'text-danger'
      }`;
    }

    setMetric('fb-theoretical-freq', formatHz(roundRecord.theoreticalFrequency));
    setMetric('fb-detected-freq', formatHz(roundRecord.detectedFrequency));
    setMetric('fb-error-hz', formatHz(roundRecord.errorHz, 3));
    setMetric('fb-error-cents', formatCents(roundRecord.errorCents));

    const specSub = document.getElementById('fb-spectrum-sub');
    if (specSub) {
      specSub.textContent = `Pico no Bin k = ${pitchResult.dominantBin} (Δf = ${formatHz(
        pitchResult.spectrum.frequencyResolution
      )})`;
    }

    // Renderiza os 3 passos visuais do pipeline didático
    const pipelineEl = document.getElementById('fb-pipeline-steps');
    if (pipelineEl) {
      const fsKhz = (pitchResult.spectrum.sampleRate / 1000).toFixed(0);
      const winName = getWindowMetadata(pitchResult.spectrum.windowType).name;
      pipelineEl.innerHTML = `
        <div class="pipeline-step">
          <span class="step-num">Passo 1 • Amostragem</span>
          <strong>Sinal Discreto <code>x[n]</code></strong>
          <span>Capturado a <code>fs = ${fsKhz} kHz</code> com <code>N = ${pitchResult.spectrum.fftSize.toLocaleString(
            'pt-BR'
          )}</code> amostras (${winName}).</span>
        </div>
        <div class="pipeline-step">
          <span class="step-num">Passo 2 • Pico na FFT</span>
          <strong>Bin <code>k = ${pitchResult.dominantBin}</code> &rarr; <code>${formatHz(
            roundRecord.detectedFrequency
          )}</code></strong>
          <span>A FFT achou a maior magnitude no bin ${
            pitchResult.dominantBin
          } e refinou o pico com parábola.</span>
        </div>
        <div class="pipeline-step">
          <span class="step-num">Passo 3 • Nota Musical</span>
          <strong>MIDI <code>${roundRecord.targetNote.midi}</code> &rarr; <span class="highlight-cyan">${
            roundRecord.targetNote.fullName
          }</span></strong>
          <span>Pela fórmula <code>69 + 12·log₂(f/440)</code>, a frequência mapeia para ${
            roundRecord.targetNote.fullName
          }.</span>
        </div>
      `;
    }

    const explanationEl = document.getElementById('fb-explanation-text');
    if (explanationEl) {
      explanationEl.textContent = roundRecord.educationalExplanation;
    }

    // Desenha os dois gráficos reais da rodada lado a lado
    requestAnimationFrame(() => {
      const waveCanvas = document.getElementById(
        'fb-waveform-canvas'
      ) as HTMLCanvasElement | null;
      if (waveCanvas) {
        renderWaveformCanvas(waveCanvas, {
          samples: signal.samples,
          sampleRate: signal.sampleRate,
          timeWindowMs: 15,
          strokeColor: '#22d3ee',
          windowTypePreview: pitchResult.spectrum.windowType,
          label: `${roundRecord.targetNote.fullName} (T = ${formatNumberPtBr(
            1000 / roundRecord.theoreticalFrequency
          )} ms)`,
        });
      }

      const specCanvas = document.getElementById(
        'fb-spectrum-canvas'
      ) as HTMLCanvasElement | null;
      if (specCanvas) {
        const maxFreqPlot =
          signal.timbre === 'harmonic'
            ? Math.max(1500, roundRecord.theoreticalFrequency * 5.4)
            : Math.max(1100, roundRecord.theoreticalFrequency * 2.2);
        renderSpectrumCanvas(specCanvas, {
          spectrum: pitchResult.spectrum,
          peakFrequency: pitchResult.estimatedFrequency,
          dominantBin: pitchResult.dominantBin,
          minFrequencyHz: 0,
          maxFrequencyHz: maxFreqPlot,
          scaleMode: 'linear',
          noteLabel: roundRecord.targetNote.fullName,
          showHarmonics: signal.timbre === 'harmonic',
        });
      }
    });

    this.announceToScreenReader(
      `${title?.textContent ?? ''} Frequência teórica ${formatHz(
        roundRecord.theoreticalFrequency
      )}, estimada pela FFT em ${formatHz(roundRecord.detectedFrequency)}.`
    );
  }

  private handleNextRound(): void {
    if (!this.matchState) return;
    this.matchState = advanceToNextRound(this.matchState);

    if (this.matchState.matchFinished) {
      this.showMatchResults();
    } else {
      this.prepareCurrentRoundUI();
    }
  }

  private showMatchResults(): void {
    if (!this.matchState) return;

    const correctCount = this.matchState.history.filter((r) => r.isCorrect).length;
    const wrongCount = this.matchState.totalRounds - correctCount;
    const accuracyPct = Math.round((correctCount / this.matchState.totalRounds) * 100);

    saveHighScore(this.matchState.difficulty, this.matchState.score);
    const evaluation = getPerformanceEvaluation(
      this.matchState.score,
      correctCount,
      this.matchState.totalRounds
    );

    const setEl = (id: string, text: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = text;
    };

    setEl('res-badge', evaluation.badge);
    setEl('res-title', evaluation.title);
    setEl('res-message', evaluation.message);
    setEl('res-score', `${this.matchState.score} / ${MAX_MATCH_SCORE}`);
    setEl('res-correct', String(correctCount));
    setEl('res-wrong', String(wrongCount));
    setEl('res-accuracy', `${accuracyPct}%`);
    setEl('res-difficulty', DIFFICULTY_CONFIGS[this.matchState.difficulty].title);

    const tbody = document.getElementById('res-history-tbody');
    if (tbody) {
      tbody.innerHTML = '';
      for (const item of this.matchState.history) {
        const tr = document.createElement('tr');
        tr.innerHTML = `
          <td>${item.roundNumber}</td>
          <td><strong>${item.targetNote.fullName}</strong></td>
          <td class="${item.isCorrect ? 'text-success' : 'text-danger'}">
            ${item.selectedNote.fullName} (${item.isCorrect ? '✓' : '✗'})
          </td>
          <td>${formatHz(item.theoreticalFrequency)}</td>
          <td>${formatHz(item.detectedFrequency)}</td>
          <td>${formatCents(item.errorCents)}</td>
          <td><strong>${item.pointsEarned}</strong>${item.usedHint ? ' (dica)' : ''}</td>
        `;
        tbody.appendChild(tr);
      }
    }

    this.switchView('results');
  }

  // =========================================================================
  // LABORATÓRIO FFT — SIMULAÇÃO INTERATIVA DE PDS
  // =========================================================================
  private populateLabPresets(): void {
    const presetSelect = document.getElementById(
      'lab-note-preset'
    ) as HTMLSelectElement | null;
    if (!presetSelect) return;

    presetSelect.innerHTML = '';

    const customOpt = document.createElement('option');
    customOpt.value = 'custom';
    customOpt.textContent = 'Frequência Livre / Arbitrária (Teste de Vazamento)';
    presetSelect.appendChild(customOpt);

    const allNotes = getHardModeNotes();
    for (const note of allNotes) {
      const opt = document.createElement('option');
      opt.value = String(note.midi);
      opt.textContent = `${note.fullName} — ${formatHz(note.frequency)} (MIDI ${note.midi})`;
      if (note.midi === 69) {
        opt.selected = true;
      }
      presetSelect.appendChild(opt);
    }
  }

  private populateEducationalAccordion(): void {
    const listEl = document.getElementById('educational-topics-list');
    if (!listEl) return;
    listEl.innerHTML = '';

    for (const topic of EDUCATIONAL_TOPICS) {
      const details = document.createElement('details');
      details.className = 'edu-details';
      details.name = 'dsp-educational-topic';
      if (topic.number === 1) {
        details.open = true;
      }

      const summary = document.createElement('summary');
      summary.className = 'edu-summary';
      summary.textContent = `${topic.number}. ${topic.title}`;

      const body = document.createElement('div');
      body.className = 'edu-body';

      if (topic.formula) {
        const formulaDiv = document.createElement('div');
        formulaDiv.className = 'edu-formula';
        formulaDiv.textContent = topic.formula;
        body.appendChild(formulaDiv);
      }

      const sumP = document.createElement('p');
      sumP.innerHTML = `<strong>Em resumo:</strong> ${topic.summary}`;
      body.appendChild(sumP);

      const detP = document.createElement('p');
      detP.textContent = topic.details;
      body.appendChild(detP);

      details.appendChild(summary);
      details.appendChild(body);
      listEl.appendChild(details);
    }
  }

  private setActiveExperimentButtons(exp: LabExperimentId): void {
    this.activeLabExperiment = exp;
    const map: Record<Exclude<LabExperimentId, 'custom'>, string> = {
      exact: 'btn-exp-exact',
      leakage: 'btn-exp-leakage',
      harmonics: 'btn-exp-harmonics',
      resolution: 'btn-exp-resolution',
    };
    (['exact', 'leakage', 'harmonics', 'resolution'] as const).forEach((k) => {
      const btn = document.getElementById(map[k]);
      btn?.classList.toggle('active', k === exp);
    });
  }

  private stopLabMicrophoneMode(): void {
    if (this.labMicAnimFrame !== null) {
      cancelAnimationFrame(this.labMicAnimFrame);
      this.labMicAnimFrame = null;
    }
    this.audioEngine.stopMicrophone();
    const micBtn = document.getElementById('btn-lab-mic-toggle') as HTMLButtonElement | null;
    if (micBtn) {
      micBtn.textContent = '🎙️ Testar com Microfone';
      micBtn.setAttribute('aria-pressed', 'false');
      micBtn.classList.remove('btn-mic-active');
    }
  }

  private async toggleLabMicrophoneMode(): Promise<void> {
    if (this.audioEngine.isMicrophoneActive()) {
      this.stopLabMicrophoneMode();
      this.updateLabSimulation();
      return;
    }

    const micBtn = document.getElementById('btn-lab-mic-toggle') as HTMLButtonElement | null;
    try {
      await this.audioEngine.startMicrophone(this.labFftSize);
      if (micBtn) {
        micBtn.textContent = '⏹️ Parar Microfone (Ao Vivo)';
        micBtn.setAttribute('aria-pressed', 'true');
        micBtn.classList.add('btn-mic-active');
      }
      this.announceToScreenReader('Captura de microfone ao vivo iniciada no Laboratório FFT.');

      const renderMicLoop = () => {
        if (!this.audioEngine.isMicrophoneActive() || this.activeView !== 'lab') {
          return;
        }
        const micSamples = this.audioEngine.getMicrophoneSamples(this.labFftSize);
        if (micSamples) {
          this.renderLiveMicrophoneFrame(micSamples);
        }
        this.labMicAnimFrame = requestAnimationFrame(renderMicLoop);
      };
      renderMicLoop();
    } catch (err) {
      this.stopLabMicrophoneMode();
      const msg =
        err instanceof Error
          ? err.message
          : 'Não foi possível acessar o microfone. Verifique as permissões do navegador.';
      const expCallout = document.getElementById('lab-experiment-callout');
      if (expCallout) {
        expCallout.innerHTML = `<strong>⚠️ Microfone indisponível:</strong> ${msg} O simulador continua operando normalmente com síntese matemática.`;
      }
      this.announceToScreenReader(msg);
    }
  }

  private renderLiveMicrophoneFrame(micSamples: Float32Array): void {
    const fs = this.audioEngine.getSampleRate();
    const pitchResult = detectPitchFromSamples(micSamples, fs, {
      fftSize: this.labFftSize,
      windowType: this.labWindow,
    });

    const otherWindowType: WindowType =
      this.labWindow === 'rectangular' ? 'hann' : 'rectangular';
    const comparisonSpectrum =
      this.labCompareWindows === 'both'
        ? analyzeSpectrum(micSamples, fs, otherWindowType)
        : undefined;

    const expCallout = document.getElementById('lab-experiment-callout');
    if (expCallout) {
      if (pitchResult.success && pitchResult.detectedNote) {
        expCallout.innerHTML = `<strong>🎙️ Microfone Ao Vivo:</strong> Capturando sinal acústico real (RMS = <code>${formatNumberPtBr(
          pitchResult.signalRms,
          3
        )}</code>). Pico espectral em <code>${formatHz(
          pitchResult.estimatedFrequency
        )}</code> &rarr; Nota identificada: <strong class="highlight-cyan">${
          pitchResult.detectedNote.note.fullName
        }</strong>.`;
      } else {
        expCallout.innerHTML = `<strong>🎙️ Microfone Ao Vivo (Aguardando som):</strong> Cante, assobie ou toque uma nota próxima ao microfone para ver a FFT identificá-la em tempo real.`;
      }
    }

    const waveCanvas = document.getElementById('lab-waveform-canvas') as HTMLCanvasElement | null;
    if (waveCanvas) {
      renderWaveformCanvas(waveCanvas, {
        samples: micSamples,
        sampleRate: fs,
        timeWindowMs: this.labTimeSpanMs,
        startSample: 0,
        strokeColor: '#34d399',
        showDiscreteSamples: this.labTimeSpanMs <= 10,
        windowTypePreview: this.labShowWindowEnv ? this.labWindow : undefined,
        label:
          pitchResult.success && pitchResult.detectedNote
            ? `🎙️ Ao Vivo: ${pitchResult.detectedNote.note.fullName} (${formatHz(
                pitchResult.estimatedFrequency
              )})`
            : '🎙️ Microfone Ao Vivo (Sinal Acústico)',
      });
    }

    const specCanvas = document.getElementById('lab-spectrum-canvas') as HTMLCanvasElement | null;
    if (specCanvas) {
      const centerFreq =
        pitchResult.success && pitchResult.estimatedFrequency > 60
          ? pitchResult.estimatedFrequency
          : this.labFrequency;
      let minFreq = 0;
      let maxFreq = 1200;
      if (this.labZoomMode === 'around-peak') {
        minFreq = Math.max(0, centerFreq - 75);
        maxFreq = centerFreq + 75;
      } else if (this.labZoomMode === 'band-3000') {
        minFreq = 0;
        maxFreq = 3000;
      }

      renderSpectrumCanvas(specCanvas, {
        spectrum: pitchResult.spectrum,
        comparisonSpectrum,
        peakFrequency: pitchResult.success ? pitchResult.estimatedFrequency : undefined,
        dominantBin: pitchResult.success ? pitchResult.dominantBin : undefined,
        minFrequencyHz: minFreq,
        maxFrequencyHz: maxFreq,
        scaleMode: this.labScaleMode,
        noteLabel: pitchResult.detectedNote?.note.fullName,
        showHarmonics: true,
      });
    }

    if (pitchResult.success && pitchResult.detectedNote) {
      this.updateLabMathPanel(fs, pitchResult, pitchResult.detectedNote.note.frequency, true);
    }
  }

  private bindLabEvents(): void {
    const presetSel = document.getElementById('lab-note-preset') as HTMLSelectElement | null;
    const freqSlider = document.getElementById('lab-freq-slider') as HTMLInputElement | null;
    const freqInput = document.getElementById('lab-freq-input') as HTMLInputElement | null;
    const timbreSel = document.getElementById('lab-timbre-select') as HTMLSelectElement | null;
    const winSel = document.getElementById('lab-window-select') as HTMLSelectElement | null;
    const compareSel = document.getElementById('lab-compare-windows') as HTMLSelectElement | null;
    const fftSizeSel = document.getElementById('lab-fftsize-select') as HTMLSelectElement | null;
    const zoomSel = document.getElementById('lab-zoom-select') as HTMLSelectElement | null;
    const scaleSel = document.getElementById('lab-scale-select') as HTMLSelectElement | null;
    const timeSpanSel = document.getElementById(
      'lab-time-span-select'
    ) as HTMLSelectElement | null;
    const showWinCheckbox = document.getElementById(
      'lab-show-window-env'
    ) as HTMLInputElement | null;

    const syncControlsFromState = () => {
      if (freqSlider) freqSlider.value = String(Math.min(1100, Math.max(110, this.labFrequency)));
      if (freqInput) freqInput.value = this.labFrequency.toFixed(2);
      if (timbreSel) timbreSel.value = this.labTimbre;
      if (winSel) winSel.value = this.labWindow;
      if (compareSel) compareSel.value = this.labCompareWindows;
      if (fftSizeSel) fftSizeSel.value = String(this.labFftSize);
      if (zoomSel) zoomSel.value = this.labZoomMode;
      if (scaleSel) scaleSel.value = this.labScaleMode;
      if (timeSpanSel) timeSpanSel.value = String(this.labTimeSpanMs);
    };

    const setLabFrequency = (newFreq: number, isFromPreset = false, exp: LabExperimentId = 'custom') => {
      if (this.audioEngine.isMicrophoneActive()) {
        this.stopLabMicrophoneMode();
      }
      const clamped = Math.max(65, Math.min(2000, newFreq));
      this.labFrequency = clamped;
      this.setActiveExperimentButtons(exp);
      if (!isFromPreset && presetSel) {
        presetSel.value = 'custom';
      }
      syncControlsFromState();
      this.updateLabSimulation();
    };

    // Experimentos Guiados de 1 Clique
    document.getElementById('btn-exp-exact')?.addEventListener('click', () => {
      if (this.audioEngine.isMicrophoneActive()) this.stopLabMicrophoneMode();
      const fs = this.audioEngine.getSampleRate();
      this.labFftSize = DEFAULT_FFT_SIZE;
      const nearestBin = Math.round((440 * this.labFftSize) / fs);
      this.labFrequency = binToFrequency(nearestBin, fs, this.labFftSize);
      this.labTimbre = 'sine';
      this.labWindow = 'rectangular';
      this.labCompareWindows = 'both';
      this.labZoomMode = 'around-peak';
      this.labScaleMode = 'db';
      if (presetSel) presetSel.value = 'custom';
      this.setActiveExperimentButtons('exact');
      syncControlsFromState();
      this.updateLabSimulation();
    });

    document.getElementById('btn-exp-leakage')?.addEventListener('click', () => {
      if (this.audioEngine.isMicrophoneActive()) this.stopLabMicrophoneMode();
      const fs = this.audioEngine.getSampleRate();
      this.labFftSize = DEFAULT_FFT_SIZE;
      const nearestBin = Math.round((440 * this.labFftSize) / fs);
      this.labFrequency = binToFrequency(nearestBin + 0.5, fs, this.labFftSize);
      this.labTimbre = 'sine';
      this.labWindow = 'hann';
      this.labCompareWindows = 'both';
      this.labZoomMode = 'around-peak';
      this.labScaleMode = 'db';
      if (presetSel) presetSel.value = 'custom';
      this.setActiveExperimentButtons('leakage');
      syncControlsFromState();
      this.updateLabSimulation();
    });

    document.getElementById('btn-exp-harmonics')?.addEventListener('click', () => {
      if (this.audioEngine.isMicrophoneActive()) this.stopLabMicrophoneMode();
      this.labFftSize = DEFAULT_FFT_SIZE;
      this.labFrequency = 440;
      this.labTimbre = 'harmonic';
      this.labWindow = 'hann';
      this.labCompareWindows = 'single';
      this.labZoomMode = 'band-3000';
      this.labScaleMode = 'linear';
      if (presetSel) presetSel.value = '69';
      this.setActiveExperimentButtons('harmonics');
      syncControlsFromState();
      this.updateLabSimulation();
    });

    document.getElementById('btn-exp-resolution')?.addEventListener('click', () => {
      if (this.audioEngine.isMicrophoneActive()) this.stopLabMicrophoneMode();
      this.labFftSize = 2048;
      this.labFrequency = 130.8128; // Dó3 (MIDI 48)
      this.labTimbre = 'sine';
      this.labWindow = 'hann';
      this.labCompareWindows = 'both';
      this.labZoomMode = 'around-peak';
      this.labScaleMode = 'db';
      if (presetSel) presetSel.value = '48';
      this.setActiveExperimentButtons('resolution');
      syncControlsFromState();
      this.updateLabSimulation();
    });

    presetSel?.addEventListener('change', () => {
      if (presetSel.value === 'custom') return;
      const midi = Number(presetSel.value);
      const note = getHardModeNotes().find((n) => n.midi === midi);
      if (note) {
        setLabFrequency(note.frequency, true, 'custom');
      }
    });

    freqSlider?.addEventListener('input', () => {
      setLabFrequency(Number(freqSlider.value), false, 'custom');
    });

    freqInput?.addEventListener('change', () => {
      const val = Number(freqInput.value);
      if (Number.isFinite(val) && val > 0) {
        setLabFrequency(val, false, 'custom');
      }
    });

    // Botões didáticos para alinhar ou desalinhar exatamente aos bins da DFT
    document.getElementById('btn-lab-align-bin')?.addEventListener('click', () => {
      const fs = this.audioEngine.getSampleRate();
      const nearestBin = Math.round((this.labFrequency * this.labFftSize) / fs);
      const exactBinFreq = binToFrequency(nearestBin, fs, this.labFftSize);
      setLabFrequency(exactBinFreq, false, 'exact');
    });

    document.getElementById('btn-lab-misalign-bin')?.addEventListener('click', () => {
      const fs = this.audioEngine.getSampleRate();
      const nearestBin = Math.round((this.labFrequency * this.labFftSize) / fs);
      const halfBinFreq = binToFrequency(nearestBin + 0.5, fs, this.labFftSize);
      setLabFrequency(halfBinFreq, false, 'leakage');
    });

    timbreSel?.addEventListener('change', () => {
      if (this.audioEngine.isMicrophoneActive()) this.stopLabMicrophoneMode();
      this.labTimbre = timbreSel.value as TimbreType;
      this.setActiveExperimentButtons('custom');
      this.updateLabSimulation();
    });

    winSel?.addEventListener('change', () => {
      this.labWindow = winSel.value as WindowType;
      this.updateLabSimulation();
    });

    compareSel?.addEventListener('change', () => {
      this.labCompareWindows = compareSel.value as 'both' | 'single';
      this.updateLabSimulation();
    });

    fftSizeSel?.addEventListener('change', () => {
      const nVal = Number(fftSizeSel.value);
      if ([1024, 2048, 4096, 8192, 16384].includes(nVal)) {
        this.labFftSize = nVal;
        this.audioEngine.setMicrophoneFftSize(nVal);
        this.updateLabSimulation();
      }
    });

    zoomSel?.addEventListener('change', () => {
      this.labZoomMode = zoomSel.value as 'around-peak' | 'band-1200' | 'band-3000';
      this.updateLabSimulation();
    });

    scaleSel?.addEventListener('change', () => {
      this.labScaleMode = scaleSel.value as 'db' | 'linear';
      this.updateLabSimulation();
    });

    timeSpanSel?.addEventListener('change', () => {
      this.labTimeSpanMs = Number(timeSpanSel.value);
      this.updateLabSimulation();
    });

    showWinCheckbox?.addEventListener('change', () => {
      this.labShowWindowEnv = showWinCheckbox.checked;
      this.updateLabSimulation();
    });

    document.getElementById('btn-lab-play-audio')?.addEventListener('click', () => {
      if (this.audioEngine.isMicrophoneActive()) {
        this.stopLabMicrophoneMode();
      }
      void this.audioEngine.synthesizeAndPlay(this.labFrequency, this.labTimbre, 1.2);
    });

    document.getElementById('btn-lab-mic-toggle')?.addEventListener('click', () => {
      void this.toggleLabMicrophoneMode();
    });

    document.getElementById('btn-lab-back-game')?.addEventListener('click', () => {
      if (this.matchState && !this.matchState.matchFinished) {
        this.switchView('game');
      } else {
        this.switchView('home');
      }
    });
  }

  private updateLabMathPanel(
    fs: number,
    pitchResult: PitchDetectionResult,
    referenceFreq: number,
    isLiveMic = false
  ): void {
    if (!pitchResult.success || !pitchResult.detectedNote) return;

    const detected = pitchResult.detectedNote;
    const N = pitchResult.spectrum.fftSize;
    const synthErrHz = calculateAbsoluteErrorHz(pitchResult.estimatedFrequency, referenceFreq);
    const synthErrCents = calculateCentsError(pitchResult.estimatedFrequency, referenceFreq);
    const winMeta = getWindowMetadata(this.labWindow);

    const dftOps = N * N;
    const fftOps = Math.round(N * Math.log2(N));
    const speedup = Math.round(dftOps / fftOps);
    const dftMillions =
      dftOps >= 1_000_000
        ? `${formatNumberPtBr(dftOps / 1_000_000, 1)}M`
        : dftOps.toLocaleString('pt-BR');

    const setLabVal = (id: string, val: string) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };

    setLabVal('lab-val-note', `${detected.note.fullName} (MIDI ${detected.note.midi})`);
    setLabVal(
      'lab-val-synth-freq',
      isLiveMic ? 'Sinal de Microfone (Ao Vivo)' : formatHz(this.labFrequency)
    );
    setLabVal('lab-val-est-freq', formatHz(pitchResult.estimatedFrequency));
    setLabVal('lab-val-note-freq', formatHz(detected.note.frequency));
    setLabVal('lab-val-fs', `${fs.toLocaleString('pt-BR')} Hz`);
    setLabVal('lab-val-n', N.toLocaleString('pt-BR'));
    setLabVal('lab-val-deltaf', formatHz(pitchResult.spectrum.frequencyResolution));
    setLabVal(
      'lab-val-bin',
      `k = ${pitchResult.dominantBin} (interp: ${formatNumberPtBr(
        pitchResult.interpolatedBin,
        2
      )})`
    );
    setLabVal('lab-val-err-hz', formatHz(synthErrHz, 3));
    setLabVal('lab-val-err-cents', formatCents(synthErrCents));
    setLabVal('lab-val-note-cents', formatCents(detected.centsDeviation));
    setLabVal('lab-val-window', winMeta.name);
    setLabVal(
      'lab-val-win-props',
      `Lóbulo: ${winMeta.mainLobeWidthBins} bins | 1º Lateral: ${formatNumberPtBr(
        winMeta.firstSidelobeDb,
        1
      )} dB (${winMeta.rolloffDbPerOctave} dB/oit.)`
    );
    setLabVal(
      'lab-val-complexity',
      `${fftOps.toLocaleString('pt-BR')} vs. ${dftMillions} (${speedup.toLocaleString(
        'pt-BR'
      )}× mais rápida)`
    );
  }

  private updateLabSimulation(): void {
    if (this.audioEngine.isMicrophoneActive()) {
      return;
    }

    const fs = this.audioEngine.getSampleRate();
    const synthSignal = synthesizeNoteSamples({
      frequency: this.labFrequency,
      sampleRate: fs,
      durationSeconds: 0.6,
      timbre: this.labTimbre,
      attackSeconds: 0.02,
      releaseSeconds: 0.04,
    });

    const pitchResult = detectPitchFromSamples(synthSignal.samples, fs, {
      fftSize: this.labFftSize,
      windowType: this.labWindow,
      theoreticalFrequency: this.labFrequency,
    });

    const otherWindowType: WindowType =
      this.labWindow === 'rectangular' ? 'hann' : 'rectangular';
    const stableSegment = extractStableSegment(synthSignal.samples, this.labFftSize, fs, 0.03);
    const comparisonSpectrum =
      this.labCompareWindows === 'both'
        ? analyzeSpectrum(stableSegment, fs, otherWindowType)
        : undefined;

    const winMeta = getWindowMetadata(this.labWindow);
    const otherWinMeta = getWindowMetadata(otherWindowType);

    // Atualiza texto didático do experimento ativo
    const expCallout = document.getElementById('lab-experiment-callout');
    const leakageCallout = document.getElementById('lab-leakage-callout');
    const deltaF = fs / this.labFftSize;

    if (leakageCallout) {
      leakageCallout.innerHTML = `No zoom próximo ao pico (±75 Hz), cada haste/ponto representa um <strong>bin discreto X[k] da DFT</strong> espaçado em <code>Δf = ${formatHz(
        deltaF
      )}</code> amostrando a DTFT.`;
    }

    if (expCallout) {
      const exactBin = (this.labFrequency * this.labFftSize) / fs;
      const fracDistance = Math.abs(exactBin - Math.round(exactBin));
      if (this.activeLabExperiment === 'resolution' || this.labFftSize <= 2048) {
        expCallout.innerHTML = `<strong>🔬 Resolução Espectral (N = ${this.labFftSize.toLocaleString(
          'pt-BR'
        )} &rarr; Δf = ${formatHz(
          deltaF
        )}):</strong> Na 3ª oitava, a distância entre Dó3 (130,81 Hz) e Dó♯3 (138,59 Hz) é de apenas <strong>7,78 Hz</strong>. Com N pequeno, os bins ficam muito espaçados, mostrando na prática o compromisso entre resolução em frequência e tamanho da janela!`;
      } else if (this.activeLabExperiment === 'exact' || fracDistance < 0.01) {
        expCallout.innerHTML = `<strong>🎯 Bin Exato (k = ${Math.round(
          exactBin
        )}):</strong> A frequência <code>${formatHz(
          this.labFrequency
        )}</code> fecha exatamente ${Math.round(
          exactBin
        )} ciclos inteiros dentro das ${this.labFftSize.toLocaleString(
          'pt-BR'
        )} amostras. Veja como a <strong>Janela Retangular</strong> concentra toda a energia em um único bin da DFT!`;
      } else if (this.activeLabExperiment === 'harmonics' || this.labTimbre === 'harmonic') {
        expCallout.innerHTML = `<strong>🎹 Série Harmônica:</strong> No domínio do tempo, a soma de múltiplos harmônicos altera o formato da onda, mas preserva o período fundamental <code>T = 1/f₀</code>. Na FFT, surgem raias em <code>f₀, 2f₀, 3f₀, 4f₀ e 5f₀</code>.`;
      } else {
        expCallout.innerHTML = `<strong>🌊 Vazamento Espectral (f₀ entre os bins ${Math.floor(
          exactBin
        )} e ${Math.ceil(
          exactBin
        )}):</strong> Como f₀ não é múltiplo de <code>Δf = ${formatHz(
          deltaF
        )}</code>, a Janela Retangular espalha energia (−13,3 dB). Já a <strong>${
          winMeta.name
        }</strong> (<code>${winMeta.formula}</code>) atenua o 1º lóbulo lateral para <strong>${formatNumberPtBr(
          winMeta.firstSidelobeDb,
          1
        )} dB</strong>!`;
      }
    }

    // Atualiza legendas
    const legPrimary = document.getElementById('lab-legend-primary');
    const legSecondary = document.getElementById('lab-legend-secondary');
    if (legPrimary) {
      legPrimary.textContent = `Ativa: ${winMeta.name}`;
    }
    if (legSecondary) {
      legSecondary.hidden = this.labCompareWindows !== 'both';
      legSecondary.textContent = `Referência: ${otherWinMeta.name}`;
    }

    const freqDisplay = document.getElementById('lab-freq-display');
    if (freqDisplay) {
      freqDisplay.textContent = formatHz(this.labFrequency);
    }

    // Renderiza Painel 1: Domínio do Tempo
    const waveCanvas = document.getElementById('lab-waveform-canvas') as HTMLCanvasElement | null;
    if (waveCanvas) {
      renderWaveformCanvas(waveCanvas, {
        samples: stableSegment,
        sampleRate: fs,
        timeWindowMs: this.labTimeSpanMs,
        startSample: 0,
        strokeColor: '#22d3ee',
        showDiscreteSamples: this.labTimeSpanMs <= 10,
        windowTypePreview: this.labShowWindowEnv ? this.labWindow : undefined,
        label: `f₀ = ${formatHz(this.labFrequency)} | Período T = ${formatNumberPtBr(
          1000 / this.labFrequency
        )} ms`,
      });
    }

    // Renderiza Painéis 2 e 3: Espectro de Frequências + Comparação de Janelamento
    const specCanvas = document.getElementById('lab-spectrum-canvas') as HTMLCanvasElement | null;
    if (specCanvas && pitchResult.success) {
      let minFreq = 0;
      let maxFreq = 1200;

      if (this.labZoomMode === 'around-peak') {
        const halfSpan = this.labFftSize <= 2048 ? 140 : 75;
        minFreq = Math.max(0, this.labFrequency - halfSpan);
        maxFreq = this.labFrequency + halfSpan;
      } else if (this.labZoomMode === 'band-3000') {
        minFreq = 0;
        maxFreq = 3000;
      }

      renderSpectrumCanvas(specCanvas, {
        spectrum: pitchResult.spectrum,
        comparisonSpectrum,
        peakFrequency: pitchResult.estimatedFrequency,
        dominantBin: pitchResult.dominantBin,
        minFrequencyHz: minFreq,
        maxFrequencyHz: maxFreq,
        scaleMode: this.labScaleMode,
        noteLabel: pitchResult.detectedNote?.note.fullName,
        showHarmonics: this.labTimbre === 'harmonic',
      });
    }

    // Atualiza Painel 4: Análise Matemática
    this.updateLabMathPanel(fs, pitchResult, this.labFrequency, false);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  const app = new NotaSecretaApp();
  app.init();
});
