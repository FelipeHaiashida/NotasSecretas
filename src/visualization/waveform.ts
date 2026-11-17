/**
 * Módulo de Visualização da Forma de Onda no Domínio do Tempo (Canvas 2D)
 *
 * Renderiza o sinal discreto x[n] (ou x_w[n] janelado) com eixo horizontal em
 * milissegundos (ms) e eixo vertical em amplitude normalizada [-1, 1].
 * Inclui visualização didática opcional da envoltória da janela w[n].
 */

import { evaluateWindowEnvelope, getWindowMetadata, WindowType } from '../dsp/windows';

export interface WaveformRenderOptions {
  /** Amostras discretas a exibir */
  samples: ArrayLike<number>;
  /** Taxa de amostragem fs em Hz */
  sampleRate: number;
  /** Janela temporal a exibir em milissegundos (ex.: 15 ms para ver os ciclos claramente) */
  timeWindowMs?: number;
  /** Deslocamento inicial em amostras (padrão: região estável) */
  startSample?: number;
  /** Cor principal do traço da onda */
  strokeColor?: string;
  /** Exibir pontos discretos de amostragem quando o zoom for alto */
  showDiscreteSamples?: boolean;
  /** Exibir envoltória didática da janela w[n] (Retangular, Hann, Hamming ou Blackman) */
  windowTypePreview?: WindowType;
  /** Título opcional no canto do gráfico */
  label?: string;
}

/**
 * Desenha a forma de onda no domínio do tempo em um elemento HTMLCanvasElement.
 */
export function renderWaveformCanvas(
  canvas: HTMLCanvasElement,
  options: WaveformRenderOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(300, canvas.clientWidth || 640);
  const height = Math.max(120, canvas.clientHeight || 200);

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  // Fundo escuro limpo
  ctx.fillStyle = '#15120f';
  ctx.fillRect(0, 0, width, height);

  const padLeft = 48;
  const padRight = 18;
  const padTop = 30;
  const padBottom = 32;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;
  const centerY = padTop + plotH / 2;

  // Grade de fundo minimalista (apenas -1, 0, +1 para reduzir poluição visual)
  ctx.strokeStyle = 'rgba(239, 230, 210, 0.09)';
  ctx.lineWidth = 1;

  const amplitudeTicks = [-1, -0.5, 0, 0.5, 1];
  ctx.fillStyle = '#8a7f6c';
  ctx.font = '11px "Barlow", "Segoe UI", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  for (const amp of amplitudeTicks) {
    const y = centerY - amp * (plotH / 2);
    if (amp === -1 || amp === 0 || amp === 1) {
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();
      ctx.fillText(amp.toFixed(0), padLeft - 8, y);
    }
  }

  // Linha zero mais destacada
  ctx.strokeStyle = 'rgba(232, 184, 74, 0.28)';
  ctx.beginPath();
  ctx.moveTo(padLeft, centerY);
  ctx.lineTo(padLeft + plotW, centerY);
  ctx.stroke();

  const {
    samples,
    sampleRate,
    timeWindowMs = 15,
    startSample,
    strokeColor = '#e8b84a',
    showDiscreteSamples = false,
    windowTypePreview,
    label,
  } = options;

  const numSamplesToDisplay = Math.min(
    samples.length,
    Math.max(16, Math.round((timeWindowMs / 1000) * sampleRate))
  );

  const defaultStart =
    samples.length > numSamplesToDisplay * 2
      ? Math.floor(samples.length * 0.15)
      : 0;
  const offset = Math.min(
    Math.max(0, startSample ?? defaultStart),
    Math.max(0, samples.length - numSamplesToDisplay)
  );

  // Marcações de tempo no eixo horizontal (ms)
  const actualDurationMs = (numSamplesToDisplay / sampleRate) * 1000;
  const timeTicks = 4;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillStyle = '#8a7f6c';

  for (let i = 0; i <= timeTicks; i++) {
    const ratio = i / timeTicks;
    const x = padLeft + ratio * plotW;
    const tMs = ratio * actualDurationMs;

    ctx.strokeStyle = 'rgba(239, 230, 210, 0.07)';
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();

    ctx.fillText(`${tMs.toFixed(1).replace('.', ',')} ms`, x, padTop + plotH + 8);
  }

  // Rótulo do eixo Y
  ctx.save();
  ctx.translate(14, centerY);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#b3a68c';
  ctx.font = '11px "Barlow", "Segoe UI", system-ui, sans-serif';
  ctx.fillText('x[n]', 0, 0);
  ctx.restore();

  // Envoltória didática da janela w[n] (se ativada)
  if (windowTypePreview) {
    ctx.save();
    const isRect = windowTypePreview === 'rectangular';
    ctx.strokeStyle = isRect
      ? 'rgba(214, 64, 47, 0.6)'
      : 'rgba(239, 230, 210, 0.55)';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);

    // Envoltória superior (+w[n]) e inferior (-w[n])
    for (const sign of [1, -1]) {
      ctx.beginPath();
      for (let i = 0; i <= 80; i++) {
        const norm = i / 80;
        const wVal = evaluateWindowEnvelope(windowTypePreview, norm);
        const x = padLeft + norm * plotW;
        const y = centerY - sign * wVal * (plotH / 2);
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Etiqueta da envoltória no canto superior direito
    const winMeta = getWindowMetadata(windowTypePreview);
    const envLabel = isRect
      ? 'Envoltória w[n]: Retangular (corte abrupto)'
      : `Envoltória w[n]: ${winMeta.shortName} (1º lóbulo: ${winMeta.firstSidelobeDb.toString().replace('.', ',')} dB)`;
    ctx.font = '500 10.5px "Barlow", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = isRect ? '#f2937f' : '#efe6d2';
    ctx.fillText(envLabel, padLeft + plotW - 6, padTop + 4);
    ctx.restore();
  }

  // Desenho da forma de onda
  if (numSamplesToDisplay > 1) {
    ctx.save();
    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = 2.2;
    ctx.shadowColor = strokeColor;
    ctx.shadowBlur = 6;
    ctx.beginPath();

    for (let i = 0; i < numSamplesToDisplay; i++) {
      const sampleVal = Math.max(-1.05, Math.min(1.05, samples[offset + i] ?? 0));
      const x = padLeft + (i / (numSamplesToDisplay - 1)) * plotW;
      const y = centerY - sampleVal * (plotH / 2);

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }
    ctx.stroke();
    ctx.restore();

    // Pontos discretos x[n] caso solicitado (ex.: zoom de 10 ms)
    if (showDiscreteSamples) {
      ctx.fillStyle = '#efe6d2';
      const step = Math.max(1, Math.floor(numSamplesToDisplay / 65));
      for (let i = 0; i < numSamplesToDisplay; i += step) {
        const sampleVal = Math.max(-1.05, Math.min(1.05, samples[offset + i] ?? 0));
        const x = padLeft + (i / (numSamplesToDisplay - 1)) * plotW;
        const y = centerY - sampleVal * (plotH / 2);
        ctx.beginPath();
        ctx.arc(x, y, 2.2, 0, 2 * Math.PI);
        ctx.fill();
      }
    }
  }

  if (label) {
    ctx.fillStyle = '#d9ccb0';
    ctx.font = '600 11.5px "Barlow", "Segoe UI", system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(label, padLeft + 8, padTop + 4);
  }

  ctx.restore();
}
