'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  ExpressionField,
  NumberField,
  SelectField,
  TextField,
} from '@/components/calculators/form/fields';
import { undeterminedCoefficients } from '@/lib/calculators/metodos-numericos/coeficientes-indeterminados';

function Fields() {
  const { control } = useFormContext();
  const derivative = useWatch({ control, name: 'target' }) === 'derivada';
  return (
    <>
      <SelectField
        name="target"
        label="Fórmula a deducir"
        options={[
          { value: 'integral', label: 'Integración: ∫ f(x) dx ≈ h Σ cⱼ f(xᵢ + tⱼh)' },
          { value: 'derivada', label: 'Derivación: f⁽ᵈ⁾(xᵢ) ≈ Σ cⱼ f(xᵢ + tⱼh) / hᵈ' },
        ]}
      />
      <TextField
        name="nodes"
        label="Nodos tⱼ (en unidades de h)"
        placeholder="-1 0 1"
        hint="Posición de cada punto respecto de xᵢ: -1 0 1 son xᵢ − h, xᵢ y xᵢ + h."
      />
      {derivative ? (
        <NumberField name="order" label="Orden de la derivada d" integer />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="a" label="Desde xᵢ + a·h, a =" />
          <NumberField name="b" label="Hasta xᵢ + b·h, b =" />
        </div>
      )}
      <fieldset className="flex flex-col gap-3 rounded-lg border p-3">
        <legend className="px-1 text-sm font-medium">Aplicar a una función (opcional)</legend>
        <ExpressionField
          name="expression"
          optional
          label={<Formula tex="f(x)" />}
          previewPrefix="f(x) ="
        />
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="x0" label={<Formula tex="x_i" />} optional />
          <NumberField name="h" label="h" optional />
        </div>
      </fieldset>
    </>
  );
}

export default function UndeterminedCoefficients() {
  return (
    <CalculatorForm calculator={undeterminedCoefficients}>
      <Fields />
    </CalculatorForm>
  );
}
