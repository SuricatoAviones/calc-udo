'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { argumentValidity } from '@/lib/calculators/logica-formal-y-algoritmos/validez-de-argumentos';
import { FORMULA_HINT, FormulaField } from './FormulaField';

export default function ArgumentValidity() {
  return (
    <CalculatorForm calculator={argumentValidity}>
      <FormulaField
        name="premises"
        label="Premisas"
        multiline
        hint={`Una por línea (hasta 6). ${FORMULA_HINT}`}
      />
      <FormulaField
        name="conclusion"
        label="Conclusión"
        hint="Lo que se quiere concluir de las premisas."
      />
    </CalculatorForm>
  );
}
