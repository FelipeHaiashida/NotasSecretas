import { describe, expect, it } from 'vitest';
import { AudioEngine } from '../src/audio/audioEngine';

describe('AudioEngine — Gerenciamento de Efeitos de Disfarce Vocal', () => {
  it('deve inicializar com disfarce limpo (none) e permitir alternância de efeitos', () => {
    const engine = new AudioEngine();
    expect(engine.getVoiceDisguise()).toBe('none');
    expect(engine.isMonitoringAudio()).toBe(false);

    engine.setVoiceDisguise('dalek', { carrierFrequency: 150 });
    expect(engine.getVoiceDisguise()).toBe('dalek');
    expect(engine.getDisguiseParams().carrierFrequency).toBe(150);

    engine.setVoiceDisguise('bitcrush', { bits: 3, downsampleFactor: 12 });
    expect(engine.getVoiceDisguise()).toBe('bitcrush');
    expect(engine.getDisguiseParams().bits).toBe(3);
    expect(engine.getDisguiseParams().downsampleFactor).toBe(12);

    engine.setMonitorAudio(true);
    expect(engine.isMonitoringAudio()).toBe(true);

    engine.setMonitorAudio(false);
    expect(engine.isMonitoringAudio()).toBe(false);
  });
});
