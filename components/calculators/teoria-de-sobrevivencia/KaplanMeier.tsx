'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { TextAreaField } from '@/components/calculators/form/fields';
import { kaplanMeier } from '@/lib/calculators/teoria-de-sobrevivencia/kaplan-meier';

export default function KaplanMeier() {
  return (
    <CalculatorForm calculator={kaplanMeier}>
      <TextAreaField
        name="times"
        label="Tiempos observados"
        rows={4}
        hint="Un tiempo por unidad, separados por espacios o saltos de línea. Marca con + los censurados (la unidad salió del estudio sin fallar), p. ej. 6 6 6+ 7 9+."
      />
    </CalculatorForm>
  );
}
