'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { gameLp } from '@/lib/calculators/modelos-de-operaciones-1/juegos-programacion-lineal';
import { PayoffMatrixField } from './PayoffMatrixField';

export default function GameLp() {
  return (
    <CalculatorForm calculator={gameLp}>
      <PayoffMatrixField />
    </CalculatorForm>
  );
}
