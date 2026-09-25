import { ChevronDown } from 'lucide-react';
import type { Step } from '@/lib/calculators/types';
import { Formula } from './Formula';

/** Con más pasos que esto, solo el primero y el último empiezan abiertos. */
const OPEN_ALL_THRESHOLD = 6;

/** `nested`: los resultados intermedios van en tinta normal; el lápiz rojo queda para el resultado del paso. */
function StepBody({ step, nested = false }: { step: Step; nested?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      {step.explanation && <p className="text-muted-foreground text-sm">{step.explanation}</p>}
      {step.formula && <Formula tex={step.formula} display />}
      {step.substitution && (
        <div className="bg-muted/60 rounded-md px-3">
          <Formula tex={step.substitution} display />
        </div>
      )}
      {step.result &&
        (nested ? (
          <Formula tex={step.result} display />
        ) : (
          <div className="border-pencil text-pencil border-l-2 pl-3">
            <Formula tex={step.result} display />
          </div>
        ))}
      {step.children && step.children.length > 0 && (
        <ol className="border-border mt-1 flex flex-col gap-3 border-l pl-4">
          {step.children.map((child, i) => (
            <li key={i}>
              <p className="text-sm font-medium">{child.title}</p>
              <StepBody step={child} nested />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Procedimiento paso a paso. Cada paso se puede plegar para recorrer trazas largas en móvil. */
export function StepByStep({ steps }: { steps: Step[] }) {
  if (steps.length === 0) return null;
  const openAll = steps.length <= OPEN_ALL_THRESHOLD;
  return (
    <ol className="flex flex-col gap-2">
      {steps.map((step, i) => (
        <li key={i}>
          <details
            open={openAll || i === 0 || i === steps.length - 1}
            className="group bg-card rounded-lg border"
          >
            <summary className="hover:bg-accent/40 flex cursor-pointer list-none items-center gap-3 rounded-lg px-4 py-3 select-none [&::-webkit-details-marker]:hidden">
              <span className="bg-primary text-primary-foreground tabular flex size-6 shrink-0 items-center justify-center rounded-full font-mono text-xs">
                {i + 1}
              </span>
              <span className="flex-1 font-medium">{step.title}</span>
              <ChevronDown
                className="text-muted-foreground size-4 transition-transform group-open:rotate-180"
                aria-hidden
              />
            </summary>
            <div className="px-4 pb-4">
              <StepBody step={step} />
            </div>
          </details>
        </li>
      ))}
    </ol>
  );
}
