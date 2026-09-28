'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { hypergeometric } from '@/lib/calculators/estadistica-1/distribucion-hipergeometrica';
import { DiscreteQueryFields } from './DiscreteQueryFields';

export default function Hypergeometric() {
  return (
    <CalculatorForm calculator={hypergeometric}>
      <div className="grid grid-cols-3 gap-3">
        <NumberField name="lotSize" label="Lote N" integer />
        <NumberField name="successes" label="Éxitos k" integer />
        <NumberField name="sampleSize" label="Muestra n" integer />
      </div>
      <p className="text-muted-foreground text-xs">
        Se toman n artículos sin reemplazo de un lote de N, de los cuales k son éxitos (p. ej.
        defectuosos). X es el número de éxitos en la muestra.
      </p>
      <DiscreteQueryFields symbol="x" />
    </CalculatorForm>
  );
}
