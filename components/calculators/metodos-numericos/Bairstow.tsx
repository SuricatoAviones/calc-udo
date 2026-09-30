'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { IterationFields, NumberField, TextField } from '@/components/calculators/form/fields';
import { bairstow } from '@/lib/calculators/metodos-numericos/factores-cuadraticos';

export default function Bairstow() {
  return (
    <CalculatorForm calculator={bairstow}>
      <TextField
        name="coefficients"
        label="Coeficientes del polinomio"
        placeholder="1 -3.5 2.75 2.125 -3.875 1.25"
        hint="De mayor a menor grado, separados por espacios. Escribe 0 para los términos que faltan."
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="r0" label={<Formula tex="r_0" />} />
        <NumberField name="s0" label={<Formula tex="s_0" />} />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Valores iniciales del factor <Formula tex="x^2 - r x - s" />. Si no converge, prueba otros.
      </p>
      <IterationFields />
    </CalculatorForm>
  );
}
