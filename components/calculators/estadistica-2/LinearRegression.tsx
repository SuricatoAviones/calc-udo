'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { linearRegression } from '@/lib/calculators/estadistica-2/regresion-lineal';
import { PointsFields } from '@/components/calculators/metodos-numericos/PointsFields';

export default function LinearRegression() {
  return (
    <CalculatorForm calculator={linearRegression}>
      <PointsFields />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="alpha" label="α (confianza 1 − α)" hint="0.05 da intervalos de 95 %." />
        <NumberField
          name="x0"
          optional
          label={<Formula tex="x_0 \text{ (opcional)}" />}
          hint="Para estimar la media y predecir en x₀."
        />
      </div>
    </CalculatorForm>
  );
}
