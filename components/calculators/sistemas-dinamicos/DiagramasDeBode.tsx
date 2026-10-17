'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { diagramasDeBode } from '@/lib/calculators/sistemas-dinamicos/diagramas-de-bode';
import { TransferField } from './fields';

export default function DiagramasDeBode() {
  return (
    <CalculatorForm calculator={diagramasDeBode}>
      <TransferField
        name="openLoop"
        label="Lazo abierto G(s)H(s)"
        prefix="G(s)H(s) ="
        hint={
          <>
            Por ejemplo <code>10(s + 3)/(s(s + 2)(s^2 + s + 2))</code>. El pico de resonancia y el
            ancho de banda se calculan con realimentación unitaria.
          </>
        }
      />
    </CalculatorForm>
  );
}
