import React from 'react';
import { getBezierPath } from '@xyflow/react';
import type { EdgeProps } from '@xyflow/react';

// ─────────────────────────────────────────────────────────────────────────────
// FLOW EDGE — the "holding hands" connection between DOLLS.
// Visual states match pipeline execution:
//   idle    → dashed grey (no data flowing yet)
//   flowing → gold traveling particle + glow (this doll is active)
//   done    → solid neon green + sweep particle (data passed successfully)
//   error   → solid neon red + pulse (this connection broke)
// ─────────────────────────────────────────────────────────────────────────────

export type EdgeStatus = 'idle' | 'flowing' | 'done' | 'error';

const PALETTE: Record<EdgeStatus, { main: string; glow: string; width: number }> = {
  idle:    { main: '#3a3050', glow: 'none',             width: 2   },
  flowing: { main: '#d4af37', glow: '#d4af37',          width: 3   },
  done:    { main: '#00ff88', glow: '#00ff88',          width: 2.5 },
  error:   { main: '#ff2244', glow: '#ff2244',          width: 3   },
};

export default function FlowEdge({
  id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data,
}: EdgeProps) {
  const [path] = getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition });
  const status: EdgeStatus = (data?.status as EdgeStatus) ?? 'idle';
  const p = PALETTE[status];

  return (
    <g>
      {/* broad ambient glow trace */}
      {status !== 'idle' && (
        <path d={path} stroke={p.main} strokeWidth={14} fill="none" opacity={0.10} />
      )}
      {/* mid glow */}
      {status !== 'idle' && (
        <path d={path} stroke={p.main} strokeWidth={7} fill="none" opacity={0.20} />
      )}
      {/* main edge line — anchored by id so mpath can reference it */}
      <path
        id={id}
        d={path}
        stroke={p.main}
        strokeWidth={p.width}
        fill="none"
        strokeDasharray={status === 'idle' ? '7 4' : undefined}
        style={{ filter: p.glow !== 'none' ? `drop-shadow(0 0 5px ${p.glow})` : 'none' }}
      />

      {/* flowing: gold data-packet particle traveling source → target */}
      {status === 'flowing' && (
        <circle r="5.5" fill="#d4af37" style={{ filter: 'drop-shadow(0 0 9px #d4af37)' }}>
          <animateMotion dur="0.85s" repeatCount="indefinite">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}

      {/* done: neon green sweep confirms data passed */}
      {status === 'done' && (
        <circle r="4" fill="#00ff88" opacity="0.9"
                style={{ filter: 'drop-shadow(0 0 8px #00ff88)' }}>
          <animateMotion dur="1.1s" repeatCount="1" fill="freeze">
            <mpath href={`#${id}`} />
          </animateMotion>
        </circle>
      )}

      {/* error: red pulsing node sits at midpoint */}
      {status === 'error' && (
        <circle cx={sourceX + (targetX - sourceX) * 0.5}
                cy={sourceY + (targetY - sourceY) * 0.5}
                r="6" fill="#ff2244"
                style={{ filter: 'drop-shadow(0 0 10px #ff2244)' }}>
          <animate attributeName="opacity" values="1;0.3;1" dur="0.9s" repeatCount="indefinite" />
        </circle>
      )}
    </g>
  );
}
