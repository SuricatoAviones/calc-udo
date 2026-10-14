'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ecuacionesDeEstado } from '@/lib/calculators/circuitos-y-sistemas/ecuaciones-de-estado';
import type { ComponentKind } from '@/lib/calculators/circuitos-y-sistemas/circuit';
import { CircuitBuilderField } from './CircuitBuilderField';

const KINDS: readonly ComponentKind[] = [
  'resistor',
  'capacitor',
  'inductor',
  'voltage-source',
  'current-source',
];

export default function EcuacionesDeEstado() {
  return (
    <CalculatorForm calculator={ecuacionesDeEstado}>
      <CircuitBuilderField name="circuit" kinds={KINDS} />
    </CalculatorForm>
  );
}
