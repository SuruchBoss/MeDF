'use client';

import { useCallback, useRef, useState } from 'react';
import { Icon } from '@/components/icons';
import { useT } from '@/lib/i18n/provider';

/**
 * Freehand signature capture. Strokes are returned as fractions of the drawing
 * surface, so the resulting element scales without distortion.
 */

const WIDTH = 520;
const HEIGHT = 200;
/** Points closer together than this (in surface pixels) are dropped. */
const MIN_DISTANCE = 1.6;

export function SignaturePad({
  onCancel,
  onConfirm,
}: {
  onCancel: () => void;
  onConfirm: (result: {
    strokes: [number, number][][];
    color: string;
    strokeWidth: number;
    ratio: number;
  }) => void;
}) {
  const t = useT();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const strokesRef = useRef<[number, number][][]>([]);
  const drawingRef = useRef(false);
  const [color, setColor] = useState('#1d4ed8');
  const [strokeWidth, setStrokeWidth] = useState(2.4);
  const [hasInk, setHasInk] = useState(false);

  const redraw = useCallback(() => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext('2d');
    if (!canvas || !context) return;

    context.clearRect(0, 0, canvas.width, canvas.height);
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.strokeStyle = color;
    context.lineWidth = strokeWidth * 2;

    for (const stroke of strokesRef.current) {
      context.beginPath();
      stroke.forEach(([x, y], index) => {
        const px = x * canvas.width;
        const py = y * canvas.height;
        if (index === 0) context.moveTo(px, py);
        else context.lineTo(px, py);
      });
      if (stroke.length === 1) {
        context.arc(
          stroke[0][0] * canvas.width,
          stroke[0][1] * canvas.height,
          strokeWidth,
          0,
          Math.PI * 2,
        );
        context.fillStyle = color;
        context.fill();
      }
      context.stroke();
    }
  }, [color, strokeWidth]);

  function positionOf(event: React.PointerEvent): [number, number] {
    const rect = canvasRef.current!.getBoundingClientRect();
    return [
      Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width)),
      Math.min(1, Math.max(0, (event.clientY - rect.top) / rect.height)),
    ];
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink-950/60 p-4">
      <div className="card w-full max-w-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-bold text-ink-900">{t('signature.title')}</h2>
            <p className="mt-1 text-sm text-ink-500">
              {t('signature.hint')}
            </p>
          </div>
          <button type="button" onClick={onCancel} className="btn-ghost btn-sm" aria-label={t('common.close')}>
            <Icon name="x" size={18} />
          </button>
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border-2 border-dashed border-ink-200 bg-white">
          <canvas
            ref={canvasRef}
            width={WIDTH}
            height={HEIGHT}
            className="block w-full touch-none"
            style={{ aspectRatio: `${WIDTH} / ${HEIGHT}`, height: 'auto' }}
            onPointerDown={(event) => {
              event.currentTarget.setPointerCapture(event.pointerId);
              drawingRef.current = true;
              strokesRef.current.push([positionOf(event)]);
              setHasInk(true);
              redraw();
            }}
            onPointerMove={(event) => {
              if (!drawingRef.current) return;
              const stroke = strokesRef.current.at(-1);
              if (!stroke) return;
              const point = positionOf(event);
              const previous = stroke.at(-1);
              if (previous) {
                const dx = (point[0] - previous[0]) * WIDTH;
                const dy = (point[1] - previous[1]) * HEIGHT;
                if (Math.hypot(dx, dy) < MIN_DISTANCE) return;
              }
              stroke.push(point);
              redraw();
            }}
            onPointerUp={() => {
              drawingRef.current = false;
            }}
            onPointerLeave={() => {
              drawingRef.current = false;
            }}
          />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-4">
          <label className="flex items-center gap-2 text-sm text-ink-600">
            {t('signature.colour')}
            <input
              type="color"
              value={color}
              onChange={(event) => {
                setColor(event.target.value);
                requestAnimationFrame(redraw);
              }}
              className="h-8 w-10 cursor-pointer rounded border border-ink-200"
            />
          </label>
          <label className="flex items-center gap-2 text-sm text-ink-600">
            {t('signature.thickness')}
            <input
              type="range"
              min={0.8}
              max={6}
              step={0.2}
              value={strokeWidth}
              onChange={(event) => {
                setStrokeWidth(Number(event.target.value));
                requestAnimationFrame(redraw);
              }}
            />
          </label>
          <button
            type="button"
            className="btn-ghost btn-sm ml-auto"
            onClick={() => {
              strokesRef.current = [];
              setHasInk(false);
              redraw();
            }}
          >
            <Icon name="trash" size={15} />
            {t('signature.clear')}
          </button>
        </div>

        <div className="mt-6 flex justify-end gap-2">
          <button type="button" className="btn-secondary" onClick={onCancel}>
            {t('common.cancel')}
          </button>
          <button
            type="button"
            className="btn-primary"
            disabled={!hasInk}
            onClick={() =>
              onConfirm({
                strokes: strokesRef.current.filter((stroke) => stroke.length > 0),
                color,
                strokeWidth,
                ratio: WIDTH / HEIGHT,
              })
            }
          >
            <Icon name="check" size={16} />
            {t('signature.place')}
          </button>
        </div>
      </div>
    </div>
  );
}
