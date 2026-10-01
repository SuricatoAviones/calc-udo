'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { penalty } from '@/lib/calculators/programacion-no-lineal/funciones-de-penalidad';
import { ConstraintsField, ObjectiveField, PointField, SenseField } from './NlpFields';

export default function Penalty() {
  return (
    <CalculatorForm calculator={penalty}>
      <SenseField />
      <ObjectiveField />
      <ConstraintsField />
      <SelectField
        name="nonNegative"
        label="No negatividad"
        options={[
          { value: 'si', label: 'Las variables son no negativas (barrera 1/xⱼ)' },
          { value: 'no', label: 'Las variables son libres' },
        ]}
      />
      <PointField
        name="start"
        label="Punto inicial interior"
        hint="Debe cumplir las desigualdades en forma estricta."
      />
      <div className="grid grid-cols-3 gap-3">
        <NumberField
          name="r0"
          label={
            <>
              Inicial <Formula tex="r" />
            </>
          }
        />
        <NumberField name="theta" label={<Formula tex="\theta" />} />
        <NumberField name="rounds" label="Valores de r" integer />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Después de cada problema, r se multiplica por θ (por ejemplo r = 1 y θ = 0.01).
      </p>
    </CalculatorForm>
  );
}
