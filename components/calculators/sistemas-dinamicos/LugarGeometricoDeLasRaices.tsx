'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { lugarGeometricoDeLasRaices } from '@/lib/calculators/sistemas-dinamicos/lugar-geometrico-de-las-raices';
import { TransferField } from './fields';

export default function LugarGeometricoDeLasRaices() {
  return (
    <CalculatorForm calculator={lugarGeometricoDeLasRaices}>
      <TransferField
        name="openLoop"
        label="Lazo abierto K·G(s)H(s)"
        prefix="KG(s)H(s) ="
        hint={
          <>
            Con la ganancia K o sin ella: <code>K/(s(s + 1)(s + 2))</code>,{' '}
            <code>(s + 2)/(s^2 + 2s + 3)</code>. El lugar se traza para K ≥ 0.
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="zeta"
          label={
            <>
              <Formula tex="\zeta" /> (opcional)
            </>
          }
          optional
          hint="K para ese amortiguamiento."
        />
        <NumberField
          name="gain"
          label={
            <>
              <Formula tex="K" /> (opcional)
            </>
          }
          optional
          hint="Polos en lazo cerrado con esa K."
        />
      </div>
    </CalculatorForm>
  );
}
