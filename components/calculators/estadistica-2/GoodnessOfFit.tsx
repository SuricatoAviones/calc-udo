'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  NumberField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/calculators/form/fields';
import {
  goodnessOfFit,
  type FitDistribution,
} from '@/lib/calculators/estadistica-2/bondad-de-ajuste';

function Fields() {
  const { control } = useFormContext();
  const distribution =
    (useWatch({ control, name: 'distribution' }) as FitDistribution | undefined) ??
    'probabilidades';
  return (
    <>
      <SelectField
        name="distribution"
        label="Distribución de H₀"
        options={[
          { value: 'probabilidades', label: 'Probabilidades dadas (o equiprobables)' },
          { value: 'poisson', label: 'Poisson' },
          { value: 'binomial', label: 'Binomial' },
          { value: 'normal', label: 'Normal (datos agrupados en clases)' },
        ]}
      />
      <TextAreaField
        name="observed"
        rows={2}
        label="Frecuencias observadas"
        hint={
          distribution === 'normal'
            ? 'Una por clase, en orden.'
            : 'Una por categoría o valor, en orden. Separadas por espacios.'
        }
      />
      {distribution === 'probabilidades' && (
        <TextField
          name="probabilities"
          label="Probabilidades de H₀ (opcional)"
          placeholder="1/6 1/6 1/6 1/6 1/6 1/6"
          hint="Una por categoría; admite fracciones. Vacío = todas las categorías igualmente probables."
        />
      )}
      {(distribution === 'poisson' || distribution === 'binomial') && (
        <TextField
          name="values"
          label="Valores de x de cada frecuencia"
          placeholder="0 1 2 3 4"
          hint="Enteros en orden creciente. El último representa «ese valor o más»."
        />
      )}
      {distribution === 'normal' && (
        <TextField
          name="boundaries"
          label="Límites de las clases"
          placeholder="1.45 1.95 2.45 2.95 3.45 3.95 4.45 4.95"
          hint="Una más que el número de clases. La primera y la última clase se extienden a −∞ y +∞."
        />
      )}
      {distribution === 'binomial' && (
        <NumberField name="trials" label="Ensayos n" integer optional />
      )}
      {distribution !== 'probabilidades' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            name="parameter1"
            optional
            label={
              distribution === 'poisson'
                ? 'λ (opcional)'
                : distribution === 'binomial'
                  ? 'p (opcional)'
                  : 'μ (opcional)'
            }
          />
          {distribution === 'normal' && (
            <NumberField name="parameter2" optional label="σ (opcional)" />
          )}
        </div>
      )}
      {distribution !== 'probabilidades' && (
        <SelectField
          name="estimated"
          label="¿Los parámetros se estimaron con esta muestra?"
          hint="Si los dejas vacíos se estiman con los datos. Cada parámetro estimado resta un grado de libertad."
          options={[
            { value: 'no', label: 'No: vienen dados en el enunciado' },
            { value: 'si', label: 'Sí: se estimaron con los datos' },
          ]}
        />
      )}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          name="merge"
          label="Celdas con eᵢ < 5"
          options={[
            { value: 'si', label: 'Combinarlas con las vecinas' },
            { value: 'no', label: 'Dejarlas como están' },
          ]}
        />
        <NumberField name="alpha" label="Nivel de significancia α" />
      </div>
    </>
  );
}

export default function GoodnessOfFit() {
  return (
    <CalculatorForm calculator={goodnessOfFit}>
      <Fields />
    </CalculatorForm>
  );
}
