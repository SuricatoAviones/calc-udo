'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField, FUNCTION_HINT, NumberField } from '@/components/calculators/form/fields';
import { oneVariable } from '@/lib/calculators/programacion-no-lineal/optimizacion-una-variable';

export default function OneVariable() {
  return (
    <CalculatorForm calculator={oneVariable}>
      <ExpressionField
        name="expression"
        label={<Formula tex="f(x)" />}
        previewPrefix="f(x) ="
        hint={FUNCTION_HINT}
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="a" label={<Formula tex="a" />} />
        <NumberField name="b" label={<Formula tex="b" />} />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Intervalo [a, b] donde se buscan los puntos estacionarios y los extremos absolutos.
      </p>
    </CalculatorForm>
  );
}
