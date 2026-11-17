/**
 * Motor de Áudio (Web Audio API)
 *
 * Responsável pelo ciclo de vida do AudioContext, controle de volume (GainNode),
 * criação de AudioBuffer a partir de amostras sintetizadas x[n] e reprodução segura
 * respeitando a política de ativação por gesto do usuário nos navegadores modernos.
 */

import { SynthesizedSignal, synthesizeNoteSamples, TimbreType } from './synthesizer';
import {
  processVoiceDisguise,
  synthesizeSpySpeechSignal,
  VoiceDisguiseParams,
  VoiceDisguiseType,
} from '../dsp/voiceDisguise';

export class AudioEngine {
  private context: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private activeSource: AudioBufferSourceNode | null = null;
  private micStream: MediaStream | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private micProcessor: ScriptProcessorNode | null = null;
  private monitorGain: GainNode | null = null;
  private isMonitoring = false;
  private activeDisguise: VoiceDisguiseType = 'none';
  private disguiseParams: VoiceDisguiseParams = {};
  private volume = 0.7;
  private playbackEndTimer: number | null = null;

  /**
   * Inicializa ou retoma o AudioContext após uma interação explícita do usuário.
   */
  public async ensureContext(): Promise<AudioContext> {
    if (!this.context) {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtx) {
        throw new Error('Web Audio API não é suportada neste navegador.');
      }
      this.context = new AudioCtx();
      this.masterGain = this.context.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(this.context.destination);
    }

    if (this.context.state === 'suspended') {
      await this.context.resume();
    }

    return this.context;
  }

  /**
   * Retorna a taxa de amostragem real do AudioContext (ou 48000 Hz caso ainda não iniciado).
   */
  public getSampleRate(): number {
    return this.context?.sampleRate ?? 48000;
  }

  /**
   * Define o volume mestre no intervalo [0, 1].
   */
  public setVolume(value: number): void {
    this.volume = Math.max(0, Math.min(1, value));
    if (this.masterGain && this.context) {
      this.masterGain.gain.setValueAtTime(this.volume, this.context.currentTime);
    }
  }

  /**
   * Obtém o volume mestre atual [0, 1].
   */
  public getVolume(): number {
    return this.volume;
  }

  /**
   * Interrompe imediatamente qualquer reprodução sonora ativa.
   */
  public stopPlayback(): void {
    if (this.playbackEndTimer !== null) {
      window.clearTimeout(this.playbackEndTimer);
      this.playbackEndTimer = null;
    }
    if (this.activeSource) {
      try {
        this.activeSource.stop();
        this.activeSource.disconnect();
      } catch {
        // Ignora erro caso o nó já tenha finalizado
      }
      this.activeSource = null;
    }
  }

  /**
   * Reproduz um conjunto de amostras discretas já sintetizadas através de um AudioBuffer.
   */
  public async playSynthesizedSignal(
    signal: SynthesizedSignal,
    onEnded?: () => void
  ): Promise<void> {
    const ctx = await this.ensureContext();
    this.stopPlayback();

    const buffer = ctx.createBuffer(1, signal.samples.length, signal.sampleRate);
    const channelData = buffer.getChannelData(0);
    channelData.set(signal.samples);

    const source = ctx.createBufferSource();
    source.buffer = buffer;

    if (!this.masterGain) {
      this.masterGain = ctx.createGain();
      this.masterGain.gain.value = this.volume;
      this.masterGain.connect(ctx.destination);
    }

    source.connect(this.masterGain);
    this.activeSource = source;

    source.onended = () => {
      if (this.activeSource === source) {
        this.activeSource = null;
      }
      if (onEnded) {
        onEnded();
      }
    };

    source.start(0);
  }

  /**
   * Sintetiza e reproduz uma frequência com o timbre especificado, retornando o sinal discreto
   * exato que foi enviado ao AudioBuffer para uso direto na análise espectral FFT.
   */
  public async synthesizeAndPlay(
    frequency: number,
    timbre: TimbreType = 'sine',
    durationSeconds = 1.2,
    onEnded?: () => void
  ): Promise<SynthesizedSignal> {
    const ctx = await this.ensureContext();
    const signal = synthesizeNoteSamples({
      frequency,
      sampleRate: ctx.sampleRate,
      durationSeconds,
      timbre,
    });
    await this.playSynthesizedSignal(signal, onEnded);
    return signal;
  }

  /**
   * Define o efeito ativo de disfarce de voz.
   */
  public setVoiceDisguise(disguise: VoiceDisguiseType, params?: VoiceDisguiseParams): void {
    this.activeDisguise = disguise;
    if (params) {
      this.disguiseParams = { ...this.disguiseParams, ...params };
    }
  }

  /**
   * Obtém o efeito ativo de disfarce de voz.
   */
  public getVoiceDisguise(): VoiceDisguiseType {
    return this.activeDisguise;
  }

  /**
   * Atualiza os parâmetros do efeito ativo.
   */
  public setDisguiseParams(params: VoiceDisguiseParams): void {
    this.disguiseParams = { ...this.disguiseParams, ...params };
  }

  /**
   * Retorna os parâmetros atuais de disfarce vocal.
   */
  public getDisguiseParams(): VoiceDisguiseParams {
    return { ...this.disguiseParams };
  }

  /**
   * Ativa ou desativa o monitoramento de áudio (escutar a própria voz nos fones).
   */
  public setMonitorAudio(enable: boolean): void {
    this.isMonitoring = enable;
    if (this.monitorGain && this.context) {
      this.monitorGain.gain.setValueAtTime(
        enable ? 0.8 : 0,
        this.context.currentTime
      );
    }
  }

  /**
   * Verifica se o monitoramento de áudio está ligado.
   */
  public isMonitoringAudio(): boolean {
    return this.isMonitoring;
  }

  /**
   * Sintetiza uma frase vocal de espionagem com formantes acústicos e aplica o disfarce ativo,
   * reproduzindo no AudioContext e retornando as amostras processadas para a FFT.
   */
  public async playSpySpeechSignal(
    disguise?: VoiceDisguiseType,
    params?: VoiceDisguiseParams,
    onEnded?: () => void
  ): Promise<SynthesizedSignal> {
    const ctx = await this.ensureContext();
    this.stopPlayback();

    const eff = disguise ?? this.activeDisguise;
    const p = params ?? this.disguiseParams;

    const rawSamples = synthesizeSpySpeechSignal(ctx.sampleRate);
    const processedSamples = processVoiceDisguise(rawSamples, ctx.sampleRate, eff, p);

    const signal: SynthesizedSignal = {
      samples: processedSamples,
      frequency: 130, // Frequência média aproximada da fala
      sampleRate: ctx.sampleRate,
      durationSeconds: processedSamples.length / ctx.sampleRate,
      timbre: 'harmonic',
    };

    await this.playSynthesizedSignal(signal, onEnded);
    return signal;
  }

  /**
   * Inicia captura de áudio do microfone em tempo real para o Laboratório FFT
   * com suporte a efeitos de disfarce de voz e monitoramento auditivo seguro.
   */
  public async startMicrophone(fftSize = 16384): Promise<void> {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error('Captura de microfone não é suportada neste navegador.');
    }
    const ctx = await this.ensureContext();
    this.stopMicrophone();
    this.stopPlayback();

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: false,
        noiseSuppression: false,
        autoGainControl: false,
      },
      video: false,
    });

    const source = ctx.createMediaStreamSource(stream);
    const analyser = ctx.createAnalyser();
    analyser.fftSize = Math.min(32768, Math.max(1024, fftSize));
    analyser.smoothingTimeConstant = 0;

    // Processador de DSP em tempo real para os efeitos de disfarce de voz
    const bufferSize = 2048;
    const processor = ctx.createScriptProcessor(bufferSize, 1, 1);

    processor.onaudioprocess = (e: AudioProcessingEvent) => {
      const input = e.inputBuffer.getChannelData(0);
      const output = e.outputBuffer.getChannelData(0);

      if (this.activeDisguise === 'none') {
        output.set(input);
      } else {
        const processed = processVoiceDisguise(
          input,
          ctx.sampleRate,
          this.activeDisguise,
          this.disguiseParams
        );
        output.set(processed);
      }
    };

    // Ganho de monitoramento (inicia em 0 para prevenir microfonia se não estiver de fone)
    const monitorGain = ctx.createGain();
    monitorGain.gain.setValueAtTime(
      this.isMonitoring ? 0.8 : 0,
      ctx.currentTime
    );

    // Encadeamento Web Audio:
    // micSource -> processor -> analyser (FFT / Osciloscópio) -> monitorGain -> masterGain
    source.connect(processor);
    processor.connect(analyser);
    analyser.connect(monitorGain);
    if (this.masterGain) {
      monitorGain.connect(this.masterGain);
    }

    this.micStream = stream;
    this.micSource = source;
    this.micAnalyser = analyser;
    this.micProcessor = processor;
    this.monitorGain = monitorGain;
  }

  /**
   * Atualiza o tamanho do bloco N do AnalyserNode do microfone se estiver ativo.
   */
  public setMicrophoneFftSize(fftSize: number): void {
    if (this.micAnalyser) {
      this.micAnalyser.fftSize = Math.min(32768, Math.max(1024, fftSize));
    }
  }

  /**
   * Lê as últimas N amostras em domínio do tempo capturadas pelo microfone.
   */
  public getMicrophoneSamples(fftSize: number): Float32Array | null {
    if (!this.micAnalyser) return null;
    if (this.micAnalyser.fftSize !== fftSize) {
      this.micAnalyser.fftSize = Math.min(32768, Math.max(1024, fftSize));
    }
    const buffer = new Float32Array(this.micAnalyser.fftSize);
    this.micAnalyser.getFloatTimeDomainData(buffer);
    return buffer;
  }

  /**
   * Verifica se o microfone está ativo no momento.
   */
  public isMicrophoneActive(): boolean {
    return this.micStream !== null && this.micAnalyser !== null;
  }

  /**
   * Encerra a captura de áudio do microfone e libera o dispositivo.
   */
  public stopMicrophone(): void {
    if (this.micProcessor) {
      try {
        this.micProcessor.disconnect();
      } catch {
        // Ignora
      }
      this.micProcessor = null;
    }
    if (this.monitorGain) {
      try {
        this.monitorGain.disconnect();
      } catch {
        // Ignora
      }
      this.monitorGain = null;
    }
    if (this.micSource) {
      try {
        this.micSource.disconnect();
      } catch {
        // Ignora falha de desconexão
      }
      this.micSource = null;
    }
    if (this.micStream) {
      this.micStream.getTracks().forEach((track) => track.stop());
      this.micStream = null;
    }
    this.micAnalyser = null;
  }

  /**
   * Libera recursos do AudioContext quando necessário.
   */
  public async dispose(): Promise<void> {
    this.stopMicrophone();
    this.stopPlayback();
    if (this.context && this.context.state !== 'closed') {
      await this.context.close();
    }
    this.context = null;
    this.masterGain = null;
  }
}
