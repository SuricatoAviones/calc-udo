'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField, TextAreaField } from '@/components/calculators/form/fields';
import {
  maximumLikelihood,
  type LikelihoodModel,
} from '@/lib/calculators/inferencia-y-diseno-de-experimentos/maxima-verosimilitud';

const DATA_HINTS: Record<LikelihoodModel, string> = {
  bernoulli: 'Un 1 por cada éxito y un 0 por cada fracaso.',
  poisson: 'Conteos: 0, 1, 2, …',
  geometrica: 'Número del ensayo en que ocurrió el primer éxito: 1, 2, 3, …',
  exponencial: 'Tiempos positivos, p. ej. tiempos de supervivencia o entre llegadas.',
  normal: 'Cualquier número real; al menos 2 datos.',
  pareto: 'Valores mayores que 1.',
};

function LikelihoodFields() {
  const { control } = useFormContext();
  const model =
    (useWatch({ control, name: 'model' }) as LikelihoodModel | undefined) ?? 'exponencial';
  return (
    <>
      <SelectField
        name="model"
        label="Distribución de la población"
        options={[
          { value: 'bernoulli', label: 'Bernoulli (p)' },
          { value: 'poisson', label: 'Poisson (λ)' },
          { value: 'geometrica', label: 'Geométrica (p)' },
          { value: 'exponencial', label: 'Exponencial (β = media)' },
          { value: 'normal', label: 'Normal (μ y σ²)' },
          { value: 'pareto', label: 'f(x) = θ / x^(θ+1), x > 1 (θ)' },
        ]}
      />
      <TextAreaField
        name="data"
        label="Muestra"
        rows={4}
        hint={`${DATA_HINTS[model]} Sepáralos con espacios, saltos de línea o punto y coma.`}
      />
    </>
  );
}

export default function MaximumLikelihood() {
  return (
    <CalculatorForm calculator={maximumLikelihood}>
      <LikelihoodFields />
    </CalculatorForm>
  );
}
