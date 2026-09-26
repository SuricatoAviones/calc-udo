'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { dualSimplex } from '@/lib/calculators/optimizacion-de-operaciones/dual-simplex';
import { LpFields } from './LpFields';

export default function DualSimplex() {
  return (
    <CalculatorForm calculator={dualSimplex}>
      <LpFields constraintsHint="Una por línea. El dual simplex necesita un renglón z óptimo desde el inicio: típicamente una minimización con costos no negativos y restricciones >=. Ej.: 3x1 + x2 >= 3." />
    </CalculatorForm>
  );
}
