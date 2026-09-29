'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { algebraicSimplex } from '@/lib/calculators/optimizacion-de-operaciones/simplex-algebraico';
import { LpFields } from './LpFields';

export default function AlgebraicSimplex() {
  return (
    <CalculatorForm calculator={algebraicSimplex}>
      <LpFields constraintsHint="Una por línea, con <= y lado derecho no negativo, para que las holguras formen la solución básica inicial (con >= o = usa el método M o el de dos fases). Ej.: 2x1 + x2 <= 4." />
    </CalculatorForm>
  );
}
