'use client';

import { Formula } from '@/components/calculators/Formula';
import {
  ExpressionField,
  FUNCTION_HINT,
  IterationFields,
  NumberField,
} from '@/components/calculators/form/fields';

/** Campos de los métodos cerrados (bisección y falsa posición). */
export function BracketingFields() {
  return (
    <>
      <ExpressionField
        name="expression"
        label={<Formula tex="f(x)" />}
        previewPrefix="f(x) ="
        hint={FUNCTION_HINT}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="xl"
          label={
            <>
              Límite inferior <Formula tex="x_l" />
            </>
          }
        />
        <NumberField
          name="xu"
          label={
            <>
              Límite superior <Formula tex="x_u" />
            </>
          }
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        f debe cambiar de signo entre <Formula tex="x_l" /> y <Formula tex="x_u" />.
      </p>
      <IterationFields />
    </>
  );
}
