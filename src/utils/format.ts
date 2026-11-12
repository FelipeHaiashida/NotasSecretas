/**
 * Utilitários de Formatação Numérica (Padrão Brasileiro pt-BR)
 */

export function formatNumberPtBr(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) return '—';
  return value.toFixed(decimals).replace('.', ',');
}

export function formatHz(value: number, decimals = 2): string {
  return `${formatNumberPtBr(value, decimals)} Hz`;
}

export function formatCents(value: number, decimals = 2): string {
  const sign = value > 0.005 ? '+' : '';
  return `${sign}${formatNumberPtBr(value, decimals)} cents`;
}
