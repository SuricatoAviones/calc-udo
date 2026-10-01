'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField, NumberField } from '@/components/calculators/form/fields';
import { convexity } from '@/lib/calculators/modelos-de-operaciones-1/convexidad';

const VARIABLES = ['x', 'x1', 'x2', 'x3', 'x4'];

export default function Convexity() {
  return (
    <CalculatorForm calculator={convexity}>
      <ExpressionField
        name="expression"
        label="Función"
        variables={VARIABLES}
        previewPrefix="f ="
        hint="Una variable con x (x^4 - 2x) o hasta cuatro con x1, …, x4 (x1^2 + x1*x2). Usa * o un espacio entre variables."
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="lower" label="Región: desde" />
        <NumberField name="upper" label="hasta" />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Si la segunda derivada o la hessiana no es constante, se revisa en esta región (cada
        variable entre los dos valores).
      </p>
    </CalculatorForm>
  );
}
