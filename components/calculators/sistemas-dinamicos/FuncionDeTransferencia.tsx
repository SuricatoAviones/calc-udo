'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CircuitBuilderField } from '@/components/calculators/circuitos-y-sistemas/CircuitBuilderField';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextField } from '@/components/calculators/form/fields';
import { MatrixField } from '@/components/calculators/form/MatrixField';
import {
  componentLabel,
  type CircuitDocument,
  type ComponentKind,
} from '@/lib/calculators/circuitos-y-sistemas/circuit';
import { funcionDeTransferencia } from '@/lib/calculators/sistemas-dinamicos/funcion-de-transferencia';
import { GridField, TransferField, useStateSize } from './fields';

const CIRCUIT_KINDS: readonly ComponentKind[] = [
  'resistor',
  'capacitor',
  'inductor',
  'voltage-source',
  'current-source',
];

function EquationFields() {
  return (
    <>
      <p className="text-muted-foreground text-xs">
        <Formula tex="a_0y^{(n)} + \cdots + a_ny = b_0x^{(m)} + \cdots + b_mx" />: escribe los
        coeficientes de mayor a menor orden de derivada, separados por espacios (p. ej.{' '}
        <code>1 3 2</code> para y″ + 3y′ + 2y). Para un sistema masa-resorte-amortiguador, m y″ + b
        y′ + k y = u: <code>m b k</code> y <code>1</code>.
      </p>
      <TextField
        name="outputCoefficients"
        label="Coeficientes de la salida y(t)"
        placeholder="1 3 2"
      />
      <TextField name="inputCoefficients" label="Coeficientes de la entrada x(t)" placeholder="1" />
    </>
  );
}

function StateSpaceFields() {
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
      <div className="grid grid-cols-2 gap-3">
        <GridField name="B" label={<Formula tex="B" />} rows={n} cols={1} />
        <NumberField name="D" label={<Formula tex="D" />} />
      </div>
      <GridField name="C" label={<Formula tex="C" />} rows={1} cols={n} />
    </>
  );
}

function CircuitFields() {
  const { control } = useFormContext();
  const circuit = useWatch({ control, name: 'circuit' }) as CircuitDocument | undefined;
  const components = circuit?.components ?? [];
  const sources = components.filter(
    (c) => c.kind === 'voltage-source' || c.kind === 'current-source',
  );
  return (
    <>
      <CircuitBuilderField name="circuit" kinds={CIRCUIT_KINDS} />
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="source"
          label="Entrada (fuente)"
          options={sources.map((c) => ({ value: c.id, label: componentLabel(c) }))}
        />
        <SelectField
          name="quantity"
          label="Salida"
          options={[
            { value: 'v', label: 'Voltaje de…' },
            { value: 'i', label: 'Corriente de…' },
          ]}
        />
      </div>
      <SelectField
        name="output"
        label="Componente de salida"
        hint="El voltaje es v_a − v_b (con + en el terminal marcado) y la corriente va del terminal marcado al otro."
        options={components.map((c) => ({ value: c.id, label: componentLabel(c) }))}
      />
    </>
  );
}

export default function FuncionDeTransferencia() {
  return (
    <CalculatorForm calculator={funcionDeTransferencia}>
      <ModeFields />
    </CalculatorForm>
  );
}

function ModeFields() {
  const { control } = useFormContext();
  const mode = useWatch({ control, name: 'mode' }) as
    'ecuacion' | 'funcion' | 'espacio-de-estados' | 'circuito';
  return (
    <>
      <SelectField
        name="mode"
        label="El sistema está dado por"
        options={[
          { value: 'ecuacion', label: 'Una ecuación diferencial' },
          { value: 'funcion', label: 'Su función de transferencia' },
          { value: 'espacio-de-estados', label: 'Ecuaciones de estado (A, B, C, D)' },
          { value: 'circuito', label: 'Un circuito eléctrico (dibujarlo)' },
        ]}
      />
      {mode === 'ecuacion' && <EquationFields />}
      {mode === 'funcion' && <TransferField name="transfer" label="G(s)" prefix="G(s) =" />}
      {mode === 'espacio-de-estados' && <StateSpaceFields />}
      {mode === 'circuito' && <CircuitFields />}
    </>
  );
}
