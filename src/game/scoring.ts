/**
 * Módulo de Pontuação e Desempenho do Jogo
 *
 * Regras de pontuação por rodada:
 * - Resposta correta sem dica: 100 pontos
 * - Resposta correta utilizando dica: 60 pontos
 * - Resposta incorreta: 0 pontos
 * - Pontuação máxima em 10 rodadas: 1.000 pontos
 */

export const POINTS_CORRECT_NO_HINT = 100;
export const POINTS_CORRECT_WITH_HINT = 60;
export const POINTS_INCORRECT = 0;
export const TOTAL_ROUNDS_PER_MATCH = 10;
export const MAX_MATCH_SCORE = TOTAL_ROUNDS_PER_MATCH * POINTS_CORRECT_NO_HINT;

/**
 * Calcula os pontos obtidos em uma única rodada.
 */
export function calculateRoundScore(isCorrect: boolean, usedHint: boolean): number {
  if (!isCorrect) {
    return POINTS_INCORRECT;
  }
  return usedHint ? POINTS_CORRECT_WITH_HINT : POINTS_CORRECT_NO_HINT;
}

/**
 * Gera mensagem avaliativa e título de desempenho ao final da partida.
 */
export function getPerformanceEvaluation(
  score: number,
  correctCount: number,
  totalRounds = TOTAL_ROUNDS_PER_MATCH
): { title: string; message: string; badge: string } {
  const accuracy = totalRounds > 0 ? (correctCount / totalRounds) * 100 : 0;

  if (score === MAX_MATCH_SCORE) {
    return {
      title: 'Ouvido Absoluto & Mestre do Espectro!',
      message:
        'Desempenho impecável! Você identificou todas as notas sem usar dicas, combinando percepção auditiva precisa com o domínio da análise de Fourier.',
      badge: '100% Perfeito',
    };
  }

  if (accuracy >= 80) {
    return {
      title: 'Excelente Sintonia Espectral!',
      message:
        'Você demonstrou ótimo reconhecimento auditivo e compreensão da relação entre frequência fundamental e notas musicais.',
      badge: 'Alta Precisão',
    };
  }

  if (accuracy >= 50) {
    return {
      title: 'Bom Progresso na Análise de Sinais!',
      message:
        'Você acertou boa parte das notas! Explore o Laboratório FFT para comparar os picos espectrais e treinar sua percepção de alturas.',
      badge: 'Em Evolução',
    };
  }

  return {
    title: 'Continue Explorando as Frequências!',
    message:
      'A percepção musical melhora com a prática. Utilize as dicas espectrais e visite o Laboratório FFT para visualizar como cada nota se comporta no domínio da frequência.',
    badge: 'Iniciante PDS',
  };
}
