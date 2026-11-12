/**
 * Módulo de Persistência Local (localStorage)
 *
 * Armazena apenas recordes por dificuldade e preferências do usuário no navegador,
 * sem necessidade de contas ou servidores externos.
 */

import { TimbreType } from '../audio/synthesizer';
import { isValidWindowType, WindowType } from '../dsp/windows';
import { DifficultyLevel } from '../game/gameLogic';

const STORAGE_KEY_HIGHSCORES = 'nota_secreta_highscores_v1';
const STORAGE_KEY_PREFS = 'nota_secreta_preferences_v2';

export interface HighScores {
  easy: number;
  intermediate: number;
  hard: number;
}

export interface UserPreferences {
  difficulty: DifficultyLevel;
  timbre: TimbreType;
  windowType: WindowType;
  volume: number;
}

const DEFAULT_HIGHSCORES: HighScores = {
  easy: 0,
  intermediate: 0,
  hard: 0,
};

const DEFAULT_PREFERENCES: UserPreferences = {
  difficulty: 'easy',
  timbre: 'harmonic',
  windowType: 'hann',
  volume: 0.75,
};

export function loadHighScores(): HighScores {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_HIGHSCORES);
    if (!raw) return { ...DEFAULT_HIGHSCORES };
    const parsed = JSON.parse(raw) as Partial<HighScores>;
    return {
      easy: typeof parsed.easy === 'number' ? parsed.easy : 0,
      intermediate: typeof parsed.intermediate === 'number' ? parsed.intermediate : 0,
      hard: typeof parsed.hard === 'number' ? parsed.hard : 0,
    };
  } catch {
    return { ...DEFAULT_HIGHSCORES };
  }
}

export function saveHighScore(difficulty: DifficultyLevel, score: number): HighScores {
  const current = loadHighScores();
  if (score > current[difficulty]) {
    current[difficulty] = score;
    try {
      window.localStorage.setItem(STORAGE_KEY_HIGHSCORES, JSON.stringify(current));
    } catch {
      // Ignora caso localStorage esteja bloqueado no iframe
    }
  }
  return current;
}

export function loadPreferences(): UserPreferences {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY_PREFS);
    if (!raw) return { ...DEFAULT_PREFERENCES };
    const parsed = JSON.parse(raw) as Partial<UserPreferences>;
    return {
      difficulty:
        parsed.difficulty === 'easy' ||
        parsed.difficulty === 'intermediate' ||
        parsed.difficulty === 'hard'
          ? parsed.difficulty
          : DEFAULT_PREFERENCES.difficulty,
      timbre:
        parsed.timbre === 'sine' || parsed.timbre === 'harmonic'
          ? parsed.timbre
          : DEFAULT_PREFERENCES.timbre,
      windowType: isValidWindowType(parsed.windowType)
        ? parsed.windowType
        : DEFAULT_PREFERENCES.windowType,
      volume:
        typeof parsed.volume === 'number' && parsed.volume >= 0 && parsed.volume <= 1
          ? parsed.volume
          : DEFAULT_PREFERENCES.volume,
    };
  } catch {
    return { ...DEFAULT_PREFERENCES };
  }
}

export function savePreferences(prefs: Partial<UserPreferences>): UserPreferences {
  const updated = { ...loadPreferences(), ...prefs };
  try {
    window.localStorage.setItem(STORAGE_KEY_PREFS, JSON.stringify(updated));
  } catch {
    // Ignora falha de armazenamento em modo privado/iframe restrito
  }
  return updated;
}
