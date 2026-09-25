'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { exponentialSmoothing } from '@/lib/calculators/modelos-de-operaciones-2/suavizamiento-exponencial';
import { SeriesDataField } from './SeriesDataField';

export default function ExponentialSmoothing() {
  return (
    <CalculatorForm calculator={exponentialSmoothing}>
      <SeriesDataField />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="alpha"
          label={
            <>
              Constante <Formula tex="\alpha" />
            </>
          }
          hint="Entre 0 y 1."
        />
        <NumberField
          name="initialForecast"
          optional
          label={
            <>
              Pronóstico <Formula tex="F_1" />
            </>
          }
          hint="Opcional. Vacío: F₂ = Y₁."
        />
      </div>
    </CalculatorForm>
  );
}
