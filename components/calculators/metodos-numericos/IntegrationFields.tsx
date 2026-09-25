'use client';

import { Formula } from '@/components/calculators/Formula';
import { ExpressionField, FUNCTION_HINT, NumberField } from '@/components/calculators/form/fields';

/** Campos comunes de la integración numérica (rectangular, trapecio, Simpson). */
export function IntegrationFields({ segmentsHint }: { segmentsHint?: string }) {
  return (
    <>
      <ExpressionField
        name="expression"
        label={<Formula tex="f(x)" />}
        previewPrefix="\int f(x)\,dx,\quad f(x) ="
        hint={FUNCTION_HINT}
      />
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="a" label={<Formula tex="a" />} />
        <NumberField name="b" label={<Formula tex="b" />} />
        <NumberField name="n" label="Segmentos n" integer />
      </div>
      {segmentsHint && <p className="text-muted-foreground -mt-2 text-xs">{segmentsHint}</p>}
      <NumberField
        name="exact"
        optional
        label="Valor exacto (opcional)"
        hint="Si lo conoces, se calculan el error verdadero y el error relativo."
      />
    </>
  );
}
