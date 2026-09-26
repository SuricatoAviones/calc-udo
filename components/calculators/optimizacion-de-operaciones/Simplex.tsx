'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { simplexTabular } from '@/lib/calculators/optimizacion-de-operaciones/simplex';
import { LpFields } from './LpFields';

export default function Simplex() {
  return (
    <CalculatorForm calculator={simplexTabular}>
      <LpFields constraintsHint="Una por línea, con <= y lado derecho no negativo, para que las holguras formen la base inicial (con >= o = usa el método M o el de dos fases). Ej.: 6x1 + 4x2 <= 24." />
    </CalculatorForm>
  );
}
