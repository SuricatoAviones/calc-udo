'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { SelectField, TextAreaField, TextField } from '@/components/calculators/form/fields';
import {
  lpLatex,
  parseLinearProgram,
  type Sense,
} from '@/lib/calculators/optimizacion-de-operaciones/lp-model';

/** Modelo tal como se leyó, para detectar errores de tipeo antes de calcular. */
function LpPreview() {
  const { control } = useFormContext();
  const [sense, objective, constraints] = useWatch({
    control,
    name: ['sense', 'objective', 'constraints'],
  }) as [Sense | undefined, string | undefined, string | undefined];
  if (!sense || !objective || !constraints) return null;
  const parsed = parseLinearProgram(sense, objective, constraints);
  if (!parsed.ok) return null;
  return (
    <div className="bg-muted/60 overflow-x-auto rounded-md px-3 py-1.5 text-sm">
      <p className="text-muted-foreground text-xs">Modelo leído:</p>
      <Formula tex={lpLatex(parsed.lp)} display />
    </div>
  );
}

/** Campos de un programa lineal: sentido, función objetivo y restricciones. */
export function LpFields({ constraintsHint }: { constraintsHint?: string }) {
  return (
    <>
      <div className="grid grid-cols-[minmax(0,7rem)_minmax(0,1fr)] gap-3">
        <SelectField
          name="sense"
          label="Objetivo"
          options={[
            { value: 'max', label: 'Maximizar' },
            { value: 'min', label: 'Minimizar' },
          ]}
        />
        <TextField
          name="objective"
          label={
            <>
              Función objetivo <Formula tex="z" />
            </>
          }
          placeholder="5x1 + 4x2"
        />
      </div>
      <TextAreaField
        name="constraints"
        label="Restricciones"
        rows={5}
        hint={
          constraintsHint ??
          'Una por línea, con <=, >= o =. Ej.: 6x1 + 4x2 <= 24. Las variables son no negativas; no hace falta escribir x1, x2 >= 0.'
        }
      />
      <LpPreview />
    </>
  );
}
