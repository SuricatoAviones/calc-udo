'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { graphical } from '@/lib/calculators/optimizacion-de-operaciones/metodo-grafico';
import { LpFields } from './LpFields';

export default function Graphical() {
  return (
    <CalculatorForm calculator={graphical}>
      <LpFields constraintsHint="Una por línea, con <=, >= o =, usando solo dos variables (x1 y x2, o x e y). Ej.: 6x1 + 4x2 <= 24. No hace falta escribir x1, x2 >= 0." />
    </CalculatorForm>
  );
}
