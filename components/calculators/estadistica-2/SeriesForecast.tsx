'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { seriesForecast } from '@/lib/calculators/estadistica-2/pronostico-de-series-de-tiempo';
import { SeriesDataFields } from './SeriesComponents';

export default function SeriesForecast() {
  return (
    <CalculatorForm calculator={seriesForecast}>
      <SeriesDataFields />
      <NumberField
        name="horizon"
        integer
        label="Periodos a pronosticar"
        hint="Pocos periodos: corto plazo. Muchos: largo plazo (solo la tendencia)."
      />
    </CalculatorForm>
  );
}
