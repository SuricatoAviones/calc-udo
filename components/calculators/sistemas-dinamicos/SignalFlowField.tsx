'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { TableField, type TableFieldColumn } from '@/components/calculators/form/TableField';

interface BranchRow {
  from: string;
  to: string;
  gain: string;
}

const COLUMNS: TableFieldColumn[] = [
  {
    key: 'from',
    header: 'De',
    ariaLabel: 'Nodo de origen',
    kind: 'text',
    minWidth: 4,
    placeholder: 'x1',
  },
  {
    key: 'to',
    header: 'A',
    ariaLabel: 'Nodo de destino',
    kind: 'text',
    minWidth: 4,
    placeholder: 'x2',
  },
  {
    key: 'gain',
    header: 'Ganancia',
    ariaLabel: 'Ganancia de la rama',
    kind: 'text',
    minWidth: 7,
    placeholder: 'G1',
  },
];

/**
 * Dibujo del flujograma: los nodos en una fila en el orden en que aparecen, las ramas hacia
 * adelante por arriba, las de realimentación por abajo y los lazos propios como un rizo.
 */
function SignalFlowPreview({ branches }: { branches: BranchRow[] }) {
  const valid = branches.filter((b) => b.from?.trim() && b.to?.trim());
  const nodes: string[] = [];
  for (const b of valid)
    for (const n of [b.from.trim(), b.to.trim()]) if (!nodes.includes(n)) nodes.push(n);
  if (nodes.length === 0) return null;
  const gap = 64;
  const width = Math.max(200, (nodes.length - 1) * gap + 60);
  const x = (name: string) => 30 + nodes.indexOf(name) * gap;
  const mid = 95;
  const height = 190;
  return (
    <figure className="flex flex-col gap-1">
      <figcaption className="text-muted-foreground text-xs">Vista del flujograma</figcaption>
      <div className="bg-card overflow-x-auto rounded-md border">
        <svg
          width={width}
          height={height}
          role="img"
          aria-label="Dibujo del flujograma con sus nodos y ramas"
        >
          <defs>
            <marker
              id="sfg-arrow"
              viewBox="0 0 10 10"
              refX="5"
              refY="5"
              markerWidth="7"
              markerHeight="7"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--foreground)" />
            </marker>
          </defs>
          {valid.map((b, i) => {
            const from = b.from.trim();
            const to = b.to.trim();
            const x1 = x(from);
            const x2 = x(to);
            const label = b.gain?.trim() || '?';
            if (from === to) {
              return (
                <g key={i}>
                  <path
                    d={`M ${x1 - 6} ${mid - 6} C ${x1 - 26} ${mid - 46}, ${x1 + 26} ${mid - 46}, ${x1 + 6} ${mid - 6}`}
                    fill="none"
                    stroke="var(--foreground)"
                    strokeWidth={1.3}
                    markerEnd="url(#sfg-arrow)"
                  />
                  <text
                    x={x1}
                    y={mid - 42}
                    textAnchor="middle"
                    fontSize="11"
                    fontFamily="monospace"
                    fill="var(--foreground)"
                  >
                    {label}
                  </text>
                </g>
              );
            }
            const forward = x2 > x1;
            const span = Math.abs(x2 - x1);
            const adjacent = span <= gap + 1;
            const bend = adjacent ? 0 : Math.min(70, 18 + span * 0.18);
            const cy = forward ? mid - bend : mid + Math.max(26, bend);
            const mx = (x1 + x2) / 2;
            const path =
              adjacent && forward
                ? `M ${x1 + 6} ${mid} L ${x2 - 6} ${mid}`
                : `M ${x1} ${mid + (forward ? -6 : 6)} Q ${mx} ${cy} ${x2} ${mid + (forward ? -6 : 6)}`;
            const ly = adjacent && forward ? mid - 6 : (mid + cy) / 2 + (forward ? -6 : 12);
            return (
              <g key={i}>
                <path
                  d={path}
                  fill="none"
                  stroke="var(--foreground)"
                  strokeWidth={1.3}
                  markerEnd="url(#sfg-arrow)"
                />
                <text
                  x={mx}
                  y={ly}
                  textAnchor="middle"
                  fontSize="11"
                  fontFamily="monospace"
                  fill="var(--foreground)"
                >
                  {label}
                </text>
              </g>
            );
          })}
          {nodes.map((n) => (
            <g key={n}>
              <circle
                cx={x(n)}
                cy={mid}
                r={5}
                fill="var(--card)"
                stroke="var(--foreground)"
                strokeWidth={1.5}
              />
              <text
                x={x(n)}
                y={mid + 20}
                textAnchor="middle"
                fontSize="12"
                fontStyle="italic"
                fill="var(--foreground)"
              >
                {n}
              </text>
            </g>
          ))}
        </svg>
      </div>
    </figure>
  );
}

/** Ramas del flujograma (de, a, ganancia) con su dibujo. */
export function SignalFlowField() {
  const { control } = useFormContext();
  const branches = (useWatch({ control, name: 'branches' }) as BranchRow[] | undefined) ?? [];
  return (
    <div className="flex flex-col gap-3">
      <TableField
        name="branches"
        label="Ramas del flujograma"
        hint={
          <>
            Cada rama va de un nodo a otro con una ganancia: un símbolo (<code>G1</code>,{' '}
            <code>-H2</code>, <code>a12</code>) o una función de s (<code>1/(s + 2)</code>). Los
            nombres de nodo son letras y números (<code>R</code>, <code>x1</code>).
          </>
        }
        columns={COLUMNS}
        newRow={() => ({ from: '', to: '', gain: '1' })}
        rowName="rama"
        min={1}
        max={60}
      />
      <SignalFlowPreview branches={branches} />
    </div>
  );
}
