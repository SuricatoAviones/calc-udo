'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, TextField } from '@/components/calculators/form/fields';
import { numeralSystems } from '@/lib/calculators/logica-formal-y-algoritmos/sistemas-de-numeracion';

export default function NumeralSystems() {
  return (
    <CalculatorForm calculator={numeralSystems}>
      <TextField
        name="number"
        label="Número"
        hint="Puede tener parte fraccionaria (punto o coma) y signo. En bases mayores que 10 usa letras: A = 10, B = 11…"
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="from" label="Base de origen" integer hint="De 2 a 36." />
        <NumberField name="to" label="Base de destino" integer hint="De 2 a 36." />
      </div>
    </CalculatorForm>
  );
}
