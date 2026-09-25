'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { mixedStrategies } from '@/lib/calculators/modelos-de-operaciones-1/estrategias-mixtas';
import { PayoffMatrixField } from './PayoffMatrixField';

export default function MixedStrategies() {
  return (
    <CalculatorForm calculator={mixedStrategies}>
      <PayoffMatrixField />
      <p className="text-muted-foreground -mt-2 text-xs">
        Después de eliminar las estrategias dominadas, a uno de los dos jugadores deben quedarle dos
        estrategias para usar el método gráfico.
      </p>
    </CalculatorForm>
  );
}
