'use client';

import { TextAreaField } from '@/components/calculators/form/fields';

/** Dos listas de datos, x y y, una junto a la otra. */
export function PointsFields({ hint }: { hint?: string }) {
  return (
    <div className="flex flex-col gap-2">
      <div className="grid grid-cols-2 gap-3">
        <TextAreaField name="x" label="Valores de x" rows={4} />
        <TextAreaField name="y" label="Valores de y" rows={4} />
      </div>
      <p className="text-muted-foreground text-xs">
        {hint ??
          'Separa los valores con espacios, saltos de línea o punto y coma. El i-ésimo x va con el i-ésimo y.'}
      </p>
    </div>
  );
}
