'use client';

import { type CSSProperties, memo } from 'react';
import { type AnyElement, FONT_CSS } from '@/lib/editor-types';

/**
 * Visual rendering of a single overlay element, in base page space
 * (1 unit = 1 PDF point = 1 CSS pixel before the stage's zoom transform).
 *
 * Everything here has an exact counterpart in `lib/pdf/render.ts`; when one
 * side changes, the other must follow.
 */

function lineArrow(
  from: [number, number],
  to: [number, number],
  w: number,
  h: number,
  size: number,
) {
  const start = { x: from[0] * w, y: from[1] * h };
  const end = { x: to[0] * w, y: to[1] * h };
  const angle = Math.atan2(end.y - start.y, end.x - start.x);
  const spread = Math.PI / 7;
  return [angle + Math.PI - spread, angle + Math.PI + spread]
    .map(
      (direction) =>
        `M ${end.x} ${end.y} L ${end.x + Math.cos(direction) * size} ${
          end.y + Math.sin(direction) * size
        }`,
    )
    .join(' ');
}

export const ElementView = memo(function ElementView({
  element,
  editing = false,
  assetUrl,
}: {
  element: AnyElement;
  editing?: boolean;
  /** Image elements are stored by id; the backend knows where the bytes are. */
  assetUrl: (assetId: string) => string;
}) {
  const fill: CSSProperties = { width: '100%', height: '100%' };

  switch (element.type) {
    case 'text':
      return (
        <div
          className="element-text"
          style={{
            ...fill,
            boxSizing: 'border-box',
            padding: element.padding,
            fontFamily: FONT_CSS[element.fontFamily],
            fontSize: element.fontSize,
            lineHeight: element.lineHeight,
            color: element.color,
            textAlign: element.align,
            fontWeight: element.bold ? 700 : 400,
            fontStyle: element.italic ? 'italic' : 'normal',
            textDecoration: element.underline ? 'underline' : 'none',
            background: element.background ?? 'transparent',
            overflow: 'hidden',
            // Hidden while the textarea overlay is active, so text is not doubled.
            visibility: editing ? 'hidden' : 'visible',
          }}
        >
          {element.text || ' '}
        </div>
      );

    case 'image':
      return (
        // eslint-disable-next-line @next/next/no-img-element -- the URL comes from the backend (our API, or a blob in the demo) and the element box sets the size.
        <img
          src={assetUrl(element.assetId)}
          alt=""
          draggable={false}
          style={{ ...fill, objectFit: 'fill', display: 'block', pointerEvents: 'none' }}
        />
      );

    case 'rect':
      return (
        <div
          style={{
            ...fill,
            boxSizing: 'border-box',
            background: element.fill ?? 'transparent',
            border: element.stroke ? `${element.strokeWidth}px solid ${element.stroke}` : 'none',
            borderRadius: element.radius,
          }}
        />
      );

    case 'ellipse':
      return (
        <div
          style={{
            ...fill,
            boxSizing: 'border-box',
            background: element.fill ?? 'transparent',
            border: element.stroke ? `${element.strokeWidth}px solid ${element.stroke}` : 'none',
            borderRadius: '50%',
          }}
        />
      );

    case 'line': {
      const size = Math.max(4, element.strokeWidth * 3.2);
      return (
        <svg
          width={element.w}
          height={element.h}
          viewBox={`0 0 ${element.w} ${element.h}`}
          style={fill}
          overflow="visible"
        >
          <line
            x1={element.from[0] * element.w}
            y1={element.from[1] * element.h}
            x2={element.to[0] * element.w}
            y2={element.to[1] * element.h}
            stroke={element.stroke}
            strokeWidth={element.strokeWidth}
            strokeLinecap="round"
          />
          {element.arrowEnd ? (
            <path
              d={lineArrow(element.from, element.to, element.w, element.h, size)}
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
          {element.arrowStart ? (
            <path
              d={lineArrow(element.to, element.from, element.w, element.h, size)}
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              strokeLinecap="round"
              fill="none"
            />
          ) : null}
        </svg>
      );
    }

    case 'draw':
      return (
        <svg
          width={element.w}
          height={element.h}
          viewBox={`0 0 ${element.w} ${element.h}`}
          style={fill}
        >
          {element.strokes.map((stroke, index) => (
            <polyline
              key={index}
              points={stroke
                .map(([fx, fy]) => `${fx * element.w},${fy * element.h}`)
                .join(' ')}
              fill="none"
              stroke={element.stroke}
              strokeWidth={element.strokeWidth}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          ))}
        </svg>
      );

    case 'highlight':
      return (
        <div
          style={{
            ...fill,
            background: element.color,
            mixBlendMode: 'multiply',
          }}
        />
      );

    case 'check': {
      if (element.variant === 'dot') {
        return (
          <svg width={element.w} height={element.h} style={fill}>
            <circle
              cx={element.w / 2}
              cy={element.h / 2}
              r={Math.min(element.w, element.h) / 2.6}
              fill={element.color}
            />
          </svg>
        );
      }
      const path =
        element.variant === 'cross'
          ? `M ${element.w * 0.18} ${element.h * 0.18} L ${element.w * 0.82} ${element.h * 0.82} M ${
              element.w * 0.82
            } ${element.h * 0.18} L ${element.w * 0.18} ${element.h * 0.82}`
          : `M ${element.w * 0.16} ${element.h * 0.55} L ${element.w * 0.4} ${element.h * 0.8} L ${
              element.w * 0.86
            } ${element.h * 0.2}`;
      return (
        <svg width={element.w} height={element.h} style={fill}>
          <path
            d={path}
            fill="none"
            stroke={element.color}
            strokeWidth={element.strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      );
    }

    default: {
      const exhaustive: never = element;
      throw new Error(`ไม่รู้จักองค์ประกอบ: ${JSON.stringify(exhaustive)}`);
    }
  }
});
