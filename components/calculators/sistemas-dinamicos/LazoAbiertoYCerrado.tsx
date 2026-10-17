'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField } from '@/components/calculators/form/fields';
import { lazoAbiertoYCerrado } from '@/lib/calculators/sistemas-dinamicos/lazo-abierto-y-cerrado';
import { TransferField } from './fields';

export default function LazoAbiertoYCerrado() {
  return (
    <CalculatorForm calculator={lazoAbiertoYCerrado}>
      <p className="text-muted-foreground text-xs">
        R(s) → punto suma → G₁(s) (controlador) → + D(s) (perturbación) → G₂(s) (planta) → C(s), con
        H(s) en la realimentación (Ogata, fig. 3-7). Escribe <code>1</code> si no hay controlador o
        la realimentación es unitaria.
      </p>
      <TransferField name="controller" label="Controlador G₁(s)" prefix="G_1(s) =" />
      <TransferField name="plant" label="Planta G₂(s)" prefix="G_2(s) =" />
      <TransferField name="feedback" label="Realimentación H(s)" prefix="H(s) =" />
      <SelectField
        name="sign"
        label="Realimentación"
        options={[
          { value: 'negativa', label: 'Negativa (−)' },
          { value: 'positiva', label: 'Positiva (+)' },
        ]}
      />
    </CalculatorForm>
  );
}
