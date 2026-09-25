import type { ReactNode } from 'react';
import type { CalculatorMeta, CalculatorResult } from '@/lib/calculators/types';
import { SeriesChart } from './charts/SeriesChart';
import { References } from './References';
import { ResultSummary, Notices } from './ResultSummary';
import { ResultTable } from './ResultTable';
import { StepByStep } from './StepByStep';

interface CalculatorLayoutProps {
  meta: CalculatorMeta;
  /** `null` mientras el estudiante no ha calculado nada. */
  result: CalculatorResult<unknown> | null;
  /** El formulario específico de la calculadora. */
  children: ReactNode;
}

function Section({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-3">
      <h2 id={id} className="text-xl font-semibold">
        {title}
      </h2>
      {children}
    </section>
  );
}

/**
 * Shell genérico de toda calculadora: entradas | resultado | procedimiento | tablas | gráficas |
 * referencias. Todo se dibuja a partir del `CalculatorResult`; la calculadora solo aporta su
 * formulario como `children`.
 *
 * Móvil: una columna, el formulario primero. Escritorio: el formulario queda fijo a la izquierda
 * mientras se recorre el procedimiento.
 */
export function CalculatorLayout({ meta, result, children }: CalculatorLayoutProps) {
  return (
    <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,21rem)_minmax(0,1fr)]">
      <aside className="bg-card flex flex-col gap-4 rounded-lg border p-4 shadow-xs sm:p-5 lg:sticky lg:top-20">
        <h2 className="text-lg font-semibold">Datos</h2>
        {children}
      </aside>

      <div className="flex min-w-0 flex-col gap-8">
        {result === null ? (
          <div className="text-muted-foreground rounded-lg border border-dashed p-6 text-sm">
            Ingresa los datos y presiona <strong className="text-foreground">Calcular</strong> para
            ver el resultado y el procedimiento completo. El formulario trae precargado el ejemplo
            del libro citado abajo.
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-3">
              <ResultSummary result={result} />
              <Notices notices={result.notices} />
            </div>

            {result.steps.length > 0 && (
              <Section id="procedimiento" title="Procedimiento">
                <StepByStep steps={result.steps} />
              </Section>
            )}

            {result.tables.length > 0 && (
              <Section id="tablas" title="Tabla de resultados">
                {result.tables.map((table) => (
                  <ResultTable key={table.id} table={table} />
                ))}
              </Section>
            )}

            {result.series.length > 0 && (
              <Section id="graficas" title="Gráficas">
                {result.series.map((series) => (
                  <SeriesChart key={series.id} series={series} />
                ))}
              </Section>
            )}
          </>
        )}

        <Section id="referencias" title="Referencias">
          <References citations={meta.citations} />
        </Section>
      </div>
    </div>
  );
}
