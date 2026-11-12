/**
 * Módulo de Visualização do Espectro de Frequências (Canvas 2D)
 *
 * Renderiza o gráfico real de magnitude da FFT |X[k]| em função da frequência f[k] (Hz),
 * destacando o pico fundamental detectado, os bins discretos k da DFT (em modo de zoom)
 * e os múltiplos harmônicos (2f₀, 3f₀, 4f₀, 5f₀) quando presentes.
 */

import { SpectrumAnalysis } from '../dsp/spectrum';
import { formatHz } from '../utils/format';

export interface SpectrumRenderOptions {
  /** Espectro principal calculado pela FFT */
  spectrum: SpectrumAnalysis;
  /** Espectro secundário opcional para comparação direta (ex.: Janela Retangular vs. Hann) */
  comparisonSpectrum?: SpectrumAnalysis;
  /** Frequência estimada do pico dominante (Hz) */
  peakFrequency?: number;
  /** Índice do bin dominante */
  dominantBin?: number;
  /** Limite máximo de frequência exibido no eixo horizontal (Hz) */
  maxFrequencyHz?: number;
  /** Limite mínimo de frequência exibido no eixo horizontal (Hz) */
  minFrequencyHz?: number;
  /** Escala vertical: 'linear' (magnitude normalizada) ou 'db' (decibéis para realçar vazamento espectral) */
  scaleMode?: 'linear' | 'db';
  /** Nota musical identificada para exibir no marcador do pico */
  noteLabel?: string;
  /** Destacar múltiplos harmônicos (2f₀, 3f₀, 4f₀, 5f₀) se visíveis na janela */
  showHarmonics?: boolean;
}

/**
 * Renderiza o espectro de frequências real em um elemento HTMLCanvasElement.
 */
export function renderSpectrumCanvas(
  canvas: HTMLCanvasElement,
  options: SpectrumRenderOptions
): void {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const dpr = window.devicePixelRatio || 1;
  const width = Math.max(300, canvas.clientWidth || 640);
  const height = Math.max(180, canvas.clientHeight || 220);

  if (canvas.width !== Math.round(width * dpr) || canvas.height !== Math.round(height * dpr)) {
    canvas.width = Math.round(width * dpr);
    canvas.height = Math.round(height * dpr);
  }

  ctx.save();
  ctx.scale(dpr, dpr);

  // Fundo escuro limpo
  ctx.fillStyle = '#090d1a';
  ctx.fillRect(0, 0, width, height);

  const padLeft = 52;
  const padRight = 20;
  const padTop = 34;
  const padBottom = 34;
  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const {
    spectrum,
    comparisonSpectrum,
    peakFrequency,
    minFrequencyHz = 0,
    maxFrequencyHz = 1200,
    scaleMode = 'linear',
    noteLabel,
    showHarmonics = false,
  } = options;

  const minFreq = Math.max(0, minFrequencyHz);
  const maxFreq = Math.min(spectrum.sampleRate / 2, Math.max(minFreq + 50, maxFrequencyHz));
  const freqSpan = maxFreq - minFreq;
  const isCloseZoom = freqSpan <= 220;

  // Grade horizontal e eixo Y (reduzida para menor poluição visual)
  ctx.font = '11px "Inter", system-ui, sans-serif';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'middle';

  const dbFloor = -80;

  if (scaleMode === 'linear') {
    const yTicks = [0, 0.5, 1.0];
    for (const val of yTicks) {
      const y = padTop + plotH * (1 - val);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(val.toFixed(1).replace('.', ','), padLeft - 8, y);
    }
  } else {
    const dbTicks = [0, -20, -40, -60, -80];
    for (const db of dbTicks) {
      const norm = (db - dbFloor) / (0 - dbFloor);
      const y = padTop + plotH * (1 - norm);
      ctx.strokeStyle = 'rgba(148, 163, 184, 0.1)';
      ctx.beginPath();
      ctx.moveTo(padLeft, y);
      ctx.lineTo(padLeft + plotW, y);
      ctx.stroke();

      ctx.fillStyle = '#64748b';
      ctx.fillText(`${db} dB`, padLeft - 8, y);
    }
  }

  // Grade vertical (Frequências em Hz)
  const numFreqTicks = 5;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';

  for (let i = 0; i <= numFreqTicks; i++) {
    const ratio = i / numFreqTicks;
    const f = minFreq + ratio * freqSpan;
    const x = padLeft + ratio * plotW;

    ctx.strokeStyle = 'rgba(148, 163, 184, 0.08)';
    ctx.beginPath();
    ctx.moveTo(x, padTop);
    ctx.lineTo(x, padTop + plotH);
    ctx.stroke();

    ctx.fillStyle = '#64748b';
    ctx.fillText(`${Math.round(f)} Hz`, x, padTop + plotH + 8);
  }

  // Rótulo do eixo Y
  ctx.save();
  ctx.translate(14, padTop + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textAlign = 'center';
  ctx.fillStyle = '#94a3b8';
  ctx.font = '11px "Inter", system-ui, sans-serif';
  ctx.fillText(scaleMode === 'db' ? '|X[k]| (dB)' : '|X[k]| norm.', 0, 0);
  ctx.restore();

  // Encontra o máximo global para normalizar no modo linear
  let globalMaxLinear = 1.0;
  if (scaleMode === 'linear') {
    let peak = 0;
    for (let k = 1; k < spectrum.normalizedMagnitudes.length; k++) {
      if (spectrum.normalizedMagnitudes[k] > peak) {
        peak = spectrum.normalizedMagnitudes[k];
      }
    }
    if (peak > 0) globalMaxLinear = peak;
  }

  const getNormY = (spec: SpectrumAnalysis, k: number): number => {
    if (scaleMode === 'linear') {
      return Math.min(1, spec.normalizedMagnitudes[k] / globalMaxLinear);
    }
    const db = Math.max(dbFloor, Math.min(0, spec.magnitudesDb[k]));
    return (db - dbFloor) / (0 - dbFloor);
  };

  // Função auxiliar para desenhar uma curva espectral
  const drawSpectrumCurve = (
    spec: SpectrumAnalysis,
    strokeColor: string,
    fillColor: string | CanvasGradient | null,
    lineWidth: number,
    drawBinDots: boolean
  ) => {
    const startBin = Math.max(0, Math.floor((minFreq * spec.fftSize) / spec.sampleRate));
    const endBin = Math.min(
      spec.frequencies.length - 1,
      Math.ceil((maxFreq * spec.fftSize) / spec.sampleRate)
    );

    if (endBin <= startBin) return;

    ctx.save();
    ctx.beginPath();
    let firstX = padLeft;

    for (let k = startBin; k <= endBin; k++) {
      const f = spec.frequencies[k];
      const x = padLeft + ((f - minFreq) / freqSpan) * plotW;
      const normY = getNormY(spec, k);
      const y = padTop + plotH * (1 - normY);

      if (k === startBin) {
        firstX = x;
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
    }

    ctx.strokeStyle = strokeColor;
    ctx.lineWidth = lineWidth;
    ctx.stroke();

    if (fillColor) {
      const lastFreq = spec.frequencies[endBin];
      const lastX = padLeft + ((lastFreq - minFreq) / freqSpan) * plotW;
      ctx.lineTo(lastX, padTop + plotH);
      ctx.lineTo(firstX, padTop + plotH);
      ctx.closePath();
      ctx.fillStyle = fillColor;
      ctx.fill();
    }

    // Desenha hastes (stems) e pontos dos bins discretos k da DFT quando estamos com zoom próximo ao pico
    if (drawBinDots) {
      ctx.fillStyle = strokeColor;
      for (let k = startBin; k <= endBin; k++) {
        const f = spec.frequencies[k];
        if (f < minFreq || f > maxFreq) continue;
        const x = padLeft + ((f - minFreq) / freqSpan) * plotW;
        const normY = getNormY(spec, k);
        const y = padTop + plotH * (1 - normY);

        if (lineWidth > 2) {
          ctx.save();
          ctx.strokeStyle = 'rgba(56, 189, 248, 0.22)';
          ctx.lineWidth = 1;
          ctx.beginPath();
          ctx.moveTo(x, padTop + plotH);
          ctx.lineTo(x, y);
          ctx.stroke();
          ctx.restore();
        }

        ctx.beginPath();
        ctx.arc(x, y, 2.8, 0, 2 * Math.PI);
        ctx.fill();
      }
    }

    ctx.restore();
  };

  // Se houver espectro de comparação (ex.: Retangular vs Hann), desenha primeiro
  if (comparisonSpectrum) {
    drawSpectrumCurve(
      comparisonSpectrum,
      'rgba(244, 63, 94, 0.85)',
      'rgba(244, 63, 94, 0.1)',
      1.5,
      isCloseZoom
    );
  }

  // Desenha o espectro principal
  const grad = ctx.createLinearGradient(0, padTop, 0, padTop + plotH);
  grad.addColorStop(0, 'rgba(56, 189, 248, 0.36)');
  grad.addColorStop(1, 'rgba(34, 211, 238, 0.02)');

  drawSpectrumCurve(spectrum, '#38bdf8', grad, 2.2, isCloseZoom);

  // Marca múltiplos harmônicos (2f₀, 3f₀, 4f₀, 5f₀) quando ativado
  if (showHarmonics && peakFrequency && peakFrequency > 20) {
    ctx.save();
    ctx.font = '600 10.5px "JetBrains Mono", monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';

    for (let h = 2; h <= 5; h++) {
      const harmFreq = peakFrequency * h;
      if (harmFreq < minFreq || harmFreq > maxFreq) continue;

      const harmBin = Math.round((harmFreq * spectrum.fftSize) / spectrum.sampleRate);
      if (harmBin < 0 || harmBin >= spectrum.frequencies.length) continue;

      const x = padLeft + ((harmFreq - minFreq) / freqSpan) * plotW;
      const normY = getNormY(spectrum, harmBin);
      const y = padTop + plotH * (1 - normY);

      ctx.strokeStyle = 'rgba(56, 189, 248, 0.35)';
      ctx.setLineDash([2, 3]);
      ctx.beginPath();
      ctx.moveTo(x, Math.max(padTop + 18, y - 4));
      ctx.lineTo(x, padTop + plotH);
      ctx.stroke();
      ctx.setLineDash([]);

      ctx.fillStyle = '#38bdf8';
      ctx.beginPath();
      ctx.arc(x, y, 3, 0, 2 * Math.PI);
      ctx.fill();

      ctx.fillStyle = '#bae6fd';
      ctx.fillText(`${h}f₀`, x, Math.max(padTop + 14, y - 6));
    }
    ctx.restore();
  }

  // Marca o pico dominante identificado (f₀)
  if (peakFrequency !== undefined && peakFrequency >= minFreq && peakFrequency <= maxFreq) {
    const peakX = padLeft + ((peakFrequency - minFreq) / freqSpan) * plotW;

    ctx.save();
    ctx.strokeStyle = '#c084fc';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([4, 4]);
    ctx.beginPath();
    ctx.moveTo(peakX, padTop);
    ctx.lineTo(peakX, padTop + plotH);
    ctx.stroke();
    ctx.setLineDash([]);

    // Círculo no topo do pico
    ctx.fillStyle = '#c084fc';
    ctx.beginPath();
    ctx.arc(peakX, padTop + 6, 4.5, 0, 2 * Math.PI);
    ctx.fill();

    // Etiqueta com frequência e nota
    const tagText = noteLabel
      ? `f₀: ${formatHz(peakFrequency)} (${noteLabel})`
      : `f₀: ${formatHz(peakFrequency)}`;

    ctx.font = '600 11px "Inter", system-ui, sans-serif';
    const textWidth = ctx.measureText(tagText).width;
    const boxW = textWidth + 14;
    const boxH = 22;
    const boxX = Math.min(
      Math.max(padLeft + 4, peakX - boxW / 2),
      padLeft + plotW - boxW - 4
    );
    const boxY = padTop + 10;

    ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
    ctx.strokeStyle = 'rgba(192, 132, 252, 0.7)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.roundRect(boxX, boxY, boxW, boxH, 6);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f3e8ff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(tagText, boxX + boxW / 2, boxY + boxH / 2);
    ctx.restore();
  }

  // Se estiver em zoom próximo, indica que os pontos são as amostras discretas da DFT sobre a DTFT
  if (isCloseZoom) {
    ctx.save();
    ctx.font = '500 10.5px "Inter", system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'top';
    ctx.fillStyle = '#94a3b8';
    ctx.fillText(
      `● Bins discretos X[k] da DFT/FFT (Δf = ${formatHz(spectrum.frequencyResolution)}) amostram a DTFT`,
      padLeft + plotW - 6,
      padTop + 4
    );
    ctx.restore();
  }

  ctx.restore();
}
