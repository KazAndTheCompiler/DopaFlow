import { useMemo, useRef } from 'react';

import type { JournalGraphData } from '@api/journal';

interface GraphViewProps {
  graph: JournalGraphData;
}

const WIDTH = 520;
const HEIGHT = 280;
const NODE_R = 10;

/** Deterministic seeded pseudo-random to position nodes without D3. */
function seededPosition(seed: string, max: number, margin: number): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (Math.imul(31, h) + seed.charCodeAt(i)) >>> 0;
  }
  return margin + (((h % (max - margin * 2)) + (max - margin * 2)) % (max - margin * 2));
}

export function GraphView({ graph }: GraphViewProps): JSX.Element {
  const svgRef = useRef<SVGSVGElement>(null);

  const nodeMap = useMemo(() => {
    const map = new Map<string, { x: number; y: number; count: number }>();
    for (const node of graph.nodes) {
      map.set(node.id, {
        x: seededPosition(`${node.id}x`, WIDTH, NODE_R + 4),
        y: seededPosition(`${node.id}y`, HEIGHT, NODE_R + 4),
        count: node.entry_count,
      });
    }
    return map;
  }, [graph.nodes]);

  if (graph.nodes.length === 0) {
    return (
      <section
        style={{
          padding: '1.25rem',
          background: 'var(--surface-2)',
          borderRadius: '18px',
          border: '1px solid var(--border-subtle)',
          color: 'var(--text-secondary)',
          fontSize: 'var(--text-sm)',
        }}
      >
        Wikilink graph — no links yet. Use <code>[[YYYY-MM-DD]]</code> in any entry to connect
        dates.
      </section>
    );
  }

  return (
    <section
      style={{
        padding: '1.25rem',
        background: 'var(--surface-2)',
        borderRadius: '18px',
        border: '1px solid var(--border-subtle)',
      }}
    >
      <strong style={{ display: 'block', marginBottom: '0.75rem' }}>Wikilink Graph</strong>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        style={{ width: '100%', height: 'auto', overflow: 'visible' }}
        aria-label="Journal wikilink graph"
      >
        {graph.edges.map((edge, i) => {
          const src = nodeMap.get(edge.source);
          const tgt = nodeMap.get(edge.target);
          if (!src || !tgt) {
            return null;
          }
          return (
            <line
              key={i}
              x1={src.x}
              y1={src.y}
              x2={tgt.x}
              y2={tgt.y}
              stroke="var(--border-subtle)"
              strokeWidth={1}
              opacity={0.6}
            />
          );
        })}
        {graph.nodes.map((node) => {
          const pos = nodeMap.get(node.id);
          if (!pos) {
            return null;
          }
          const r = NODE_R + Math.min(node.entry_count * 2, 8);
          return (
            <g key={node.id}>
              <circle cx={pos.x} cy={pos.y} r={r} fill="var(--accent)" opacity={0.75} />
              <text
                x={pos.x}
                y={pos.y + r + 10}
                textAnchor="middle"
                fontSize={9}
                fill="var(--text-secondary)"
              >
                {node.date}
              </text>
            </g>
          );
        })}
      </svg>
    </section>
  );
}

export default GraphView;
