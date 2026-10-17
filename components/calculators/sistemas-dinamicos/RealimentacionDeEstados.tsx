'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { TextField } from '@/components/calculators/form/fields';
import { MatrixField } from '@/components/calculators/form/MatrixField';
import { realimentacionDeEstados } from '@/lib/calculators/sistemas-dinamicos/realimentacion-de-estados';
import { GridField, useStateSize } from './fields';

function Matrices() {
  const n = useStateSize();
  return (
    <>
      <MatrixField
        name="A"
        label={<Formula tex="A" />}
        min={1}
        max={6}
        unit="estados"
        item="un estado"
      />
      <GridField name="B" label={<Formula tex="B" />} rows={n} cols={1} hint="Una sola entrada." />
    </>
  );
}

export default function RealimentacionDeEstados() {
  return (
    <CalculatorForm calculator={realimentacionDeEstados}>
      <p className="text-muted-foreground text-xs">
        <Formula tex="\dot{\mathbf{x}} = A\mathbf{x} + Bu,\quad u = -K\mathbf{x}" />
      </p>
      <Matrices />
      <TextField
        name="poles"
        label="Polos deseados en lazo cerrado"
        placeholder="-2 + 4j, -2 - 4j, -10"
        hint={
          <>
            Uno por estado, separados por comas, con la unidad <code>j</code>; los complejos van en
            pares conjugados.
          </>
        }
      />
      <TextField
        name="initial"
        label="Estado inicial x(0) (opcional)"
        placeholder="1, 0, 0"
        hint="Para graficar la respuesta x(t)."
      />
    </CalculatorForm>
  );
}
