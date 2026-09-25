import { AlertTriangle, CircleCheck, CircleX, Info } from 'lucide-react';
import type { CalculatorResult, Notice } from '@/lib/calculators/types';
import { cn } from '@/lib/utils';
import { Formula } from './Formula';

const NOTICE_STYLE: Record<
  Notice['level'],
  { icon: typeof Info; className: string; label: string }
> = {
  info: { icon: Info, className: 'border-border bg-muted/50', label: 'Nota' },
  warning: { icon: AlertTriangle, className: 'border-warning/60 bg-warning/10', label: 'Atención' },
  error: { icon: CircleX, className: 'border-destructive/50 bg-destructive/10', label: 'Error' },
};

export function Notices({ notices }: { notices: Notice[] }) {
  if (notices.length === 0) return null;
  return (
    <ul className="flex flex-col gap-2">
      {notices.map((notice, i) => {
        const { icon: Icon, className, label } = NOTICE_STYLE[notice.level];
        return (
          <li key={i} className={cn('flex gap-2 rounded-md border px-3 py-2 text-sm', className)}>
            <Icon className="mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              <span className="sr-only">{label}: </span>
              {notice.message}
            </p>
          </li>
        );
      })}
    </ul>
  );
}

/** Tarjeta de resultado: el valor principal destacado, o el motivo del fallo. */
export function ResultSummary({ result }: { result: CalculatorResult<unknown> }) {
  if (!result.ok) {
    return (
      <div
        role="alert"
        className="border-destructive/50 bg-destructive/10 flex gap-3 rounded-lg border p-4"
      >
        <CircleX className="text-destructive mt-0.5 size-5 shrink-0" aria-hidden />
        <div>
          <p className="font-semibold">No se obtuvo un resultado</p>
          <p className="text-sm">{result.error.message}</p>
          {result.steps.length > 0 && (
            <p className="text-muted-foreground mt-1 text-sm">
              Abajo está el procedimiento hasta el punto donde el método se detuvo.
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="bg-card rounded-lg border p-4" aria-live="polite">
      <p className="text-success mb-3 flex items-center gap-2 text-sm font-medium">
        <CircleCheck className="size-4" aria-hidden /> Resultado
      </p>
      <dl className="grid gap-x-6 gap-y-3 sm:grid-cols-2">
        {result.summary.map((item) => (
          <div key={item.label} className={cn(item.emphasis && 'sm:col-span-2')}>
            <dt className="text-muted-foreground text-xs tracking-wide uppercase">{item.label}</dt>
            <dd className={cn(item.emphasis ? 'text-pencil text-2xl' : 'text-base')}>
              <Formula tex={item.value} />
            </dd>
          </div>
        ))}
      </dl>
    </div>
  );
}
