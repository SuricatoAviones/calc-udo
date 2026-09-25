import type {
  CellValue,
  ResultTable as ResultTableData,
  TableColumn,
} from '@/lib/calculators/types';
import { formatNumber } from '@/lib/math/format';
import { cn } from '@/lib/utils';
import { Formula } from './Formula';

function Cell({ value, column }: { value: CellValue; column: TableColumn }) {
  if (value === null) return <span className="text-muted-foreground">—</span>;
  if (typeof value === 'number') return <>{formatNumber(value)}</>;
  if (column.format === 'latex') return <Formula tex={value} />;
  return <>{value}</>;
}

/** Tabla de resultados (p. ej. iteraciones). Hace scroll horizontal en pantallas angostas. */
export function ResultTable({ table }: { table: ResultTableData }) {
  return (
    <figure className="flex flex-col gap-2">
      <figcaption className="text-sm font-medium">{table.title}</figcaption>
      <div className="bg-card overflow-x-auto rounded-lg border">
        <table className="w-full min-w-max border-collapse text-sm">
          <thead className="bg-muted/60">
            <tr>
              {table.columns.map((column) => (
                <th
                  key={column.key}
                  scope="col"
                  className={cn(
                    'border-b px-3 py-2 font-medium whitespace-nowrap',
                    (column.format ?? 'number') === 'number' ? 'text-right' : 'text-left',
                  )}
                >
                  <Formula tex={column.header} />
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {table.rows.map((row, i) => (
              <tr key={i} className="even:bg-muted/25 border-b last:border-b-0">
                {table.columns.map((column) => {
                  const value = row[column.key] ?? null;
                  return (
                    <td
                      key={column.key}
                      className={cn(
                        'px-3 py-1.5 whitespace-nowrap',
                        typeof value === 'number' || value === null
                          ? 'tabular text-right font-mono text-[0.8125rem]'
                          : 'text-left',
                      )}
                    >
                      <Cell value={value} column={column} />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  );
}
