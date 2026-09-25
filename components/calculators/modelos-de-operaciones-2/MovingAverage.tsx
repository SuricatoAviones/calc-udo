'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextField } from '@/components/calculators/form/fields';
import { movingAverage } from '@/lib/calculators/modelos-de-operaciones-2/promedio-movil';
import { SeriesDataField } from './SeriesDataField';

function WeightsField() {
  const { control } = useFormContext();
  const weighted = useWatch({ control, name: 'type' }) === 'ponderado';
  if (!weighted) return null;
  return (
    <TextField
      name="weights"
      label={
        <>
          Pesos <Formula tex="w_1, w_2, \ldots, w_n" />
        </>
      }
      placeholder="3 2 1"
      hint="Del periodo más reciente al más antiguo. Pueden ser enteros (3 2 1) o fracciones que sumen 1 (0.5 0.3 0.2)."
    />
  );
}

export default function MovingAverage() {
  return (
    <CalculatorForm calculator={movingAverage}>
      <SeriesDataField />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="periods"
          integer
          label={
            <>
              Periodos <Formula tex="n" />
            </>
          }
        />
        <SelectField
          name="type"
          label="Promedio"
          options={[
            { value: 'simple', label: 'Simple' },
            { value: 'ponderado', label: 'Ponderado' },
          ]}
        />
      </div>
      <WeightsField />
    </CalculatorForm>
  );
}
