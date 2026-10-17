'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { MatrixField, Stepper } from '@/components/calculators/form/MatrixField';
import { controlabilidadYObservabilidad } from '@/lib/calculators/sistemas-dinamicos/controlabilidad-y-observabilidad';
import { GridField, useStateSize } from './fields';

function Matrices() {
  const n = useStateSize();
  const { control, setValue, getValues } = useFormContext();
  const B = useWatch({ control, name: 'B' }) as number[][] | undefined;
  const C = useWatch({ control, name: 'C' }) as number[][] | undefined;
  const inputs = B?.[0]?.length ?? 1;
  const outputs = C?.length ?? 1;
  const resize = (name: string, rows: number, cols: number, current?: number[][]) =>
    setValue(
      name,
      Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (_, j) => current?.[i]?.[j] ?? 0),
      ),
    );
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
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Entradas</span>
        <Stepper
          value={inputs}
          min={1}
          max={4}
          unit={inputs === 1 ? 'entrada' : 'entradas'}
          what="una entrada"
          onChange={(r) => {
            resize('B', n, r, B);
            resize('D', outputs, r, getValues('D') as number[][] | undefined);
          }}
        />
      </div>
      <GridField name="B" label={<Formula tex="B" />} rows={n} cols={inputs} />
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <span>Salidas</span>
        <Stepper
          value={outputs}
          min={1}
          max={4}
          unit={outputs === 1 ? 'salida' : 'salidas'}
          what="una salida"
          onChange={(m) => {
            resize('C', m, n, C);
            resize('D', m, inputs, getValues('D') as number[][] | undefined);
          }}
        />
      </div>
      <GridField name="C" label={<Formula tex="C" />} rows={outputs} cols={n} />
      <GridField name="D" label={<Formula tex="D" />} rows={outputs} cols={inputs} />
    </>
  );
}

export default function ControlabilidadYObservabilidad() {
  return (
    <CalculatorForm calculator={controlabilidadYObservabilidad}>
      <p className="text-muted-foreground text-xs">
        <Formula tex="\dot{\mathbf{x}} = A\mathbf{x} + B\mathbf{u},\quad \mathbf{y} = C\mathbf{x} + D\mathbf{u}" />
      </p>
      <Matrices />
    </CalculatorForm>
  );
}
