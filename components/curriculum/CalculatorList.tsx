import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { implementedCalculatorIds } from '@/components/calculators/registry';
import { StatusBadge } from '@/components/curriculum/StatusBadge';
import { calculatorPath, getCalculatorStatus, type CalculatorLocation } from '@/lib/curriculum';

/** Lista de calculadoras de un tema. Solo las implementadas son enlaces. */
export function CalculatorList({ items }: { items: CalculatorLocation[] }) {
  if (items.length === 0) {
    return (
      <p className="text-muted-foreground text-sm italic">
        Tema conceptual: no tiene calculadoras previstas.
      </p>
    );
  }
  return (
    <ul className="divide-border divide-y">
      {items.map((location) => {
        const { calculator } = location;
        const status = getCalculatorStatus(calculator, implementedCalculatorIds);
        const body = (
          <>
            <div className="min-w-0 flex-1">
              <p className="font-medium">{calculator.title}</p>
              <p className="text-muted-foreground text-sm">{calculator.summary}</p>
            </div>
            <StatusBadge status={status} className="shrink-0" />
          </>
        );
        return (
          <li key={calculator.id}>
            {status === 'implementada' ? (
              <Link
                href={calculatorPath(location)}
                className="hover:bg-accent/60 -mx-2 flex items-center gap-3 rounded-md px-2 py-3 transition-colors"
              >
                {body}
                <ArrowRight className="text-pencil size-4 shrink-0" aria-hidden />
              </Link>
            ) : (
              <div className="flex items-center gap-3 py-3 opacity-80">{body}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
