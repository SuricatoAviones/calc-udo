'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { errorEnEstadoEstacionario } from '@/lib/calculators/sistemas-dinamicos/error-en-estado-estacionario';
import { TransferField } from './fields';

export default function ErrorEnEstadoEstacionario() {
  return (
    <CalculatorForm calculator={errorEnEstadoEstacionario}>
      <TransferField name="forward" label="Trayectoria directa G(s)" prefix="G(s) =" />
      <TransferField
        name="feedback"
        label="Realimentación H(s)"
        prefix="H(s) ="
        hint={
          <>
            <code>1</code> para realimentación unitaria. Si no lo es, H(0) debe ser una constante
            distinta de 0.
          </>
        }
      />
      <NumberField
        name="amplitude"
        label="Amplitud R de las entradas"
        hint="Escalón R·u(t), rampa R·t y parábola R·t²/2."
      />
    </CalculatorForm>
  );
}
