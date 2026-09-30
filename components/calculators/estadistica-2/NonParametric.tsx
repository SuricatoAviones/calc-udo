'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextAreaField } from '@/components/calculators/form/fields';
import {
  nonParametric,
  type NonParametricTest,
} from '@/lib/calculators/estadistica-2/pruebas-no-parametricas';
import { TestFields } from './TestFields';

function Fields() {
  const { control } = useFormContext();
  const test = (useWatch({ control, name: 'test' }) as NonParametricTest | undefined) ?? 'signo';
  const oneSample = test === 'signo' || test === 'wilcoxon';
  return (
    <>
      <SelectField
        name="test"
        label="Prueba"
        options={[
          { value: 'signo', label: 'Prueba del signo' },
          { value: 'wilcoxon', label: 'Rangos con signo de Wilcoxon' },
          { value: 'mann-whitney', label: 'Suma de rangos (U de Mann-Whitney)' },
          { value: 'kruskal-wallis', label: 'Kruskal-Wallis (k muestras)' },
        ]}
      />
      {test === 'kruskal-wallis' ? (
        <TextAreaField
          name="groups"
          rows={5}
          label="Grupos"
          hint="Un grupo por renglón, con sus datos separados por espacios."
        />
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <TextAreaField
            name="sample1"
            label={oneSample ? 'Datos (o primera muestra pareada)' : 'Muestra 1'}
          />
          <TextAreaField
            name="sample2"
            label={oneSample ? 'Segunda muestra pareada (opcional)' : 'Muestra 2'}
            hint={oneSample ? 'Si la escribes, se usan las diferencias x₁ − x₂.' : undefined}
          />
        </div>
      )}
      {oneSample && (
        <NumberField
          name="median0"
          label={<Formula tex="\tilde{\mu}_0 \text{ (mediana de } H_0)" />}
          hint="Con datos pareados suele ser 0."
        />
      )}
      {test === 'kruskal-wallis' ? (
        <NumberField name="alpha" label="Nivel de significancia α" />
      ) : (
        <TestFields parameter={oneSample ? 'μ̃' : 'μ̃₁'} value={oneSample ? 'μ̃₀' : 'μ̃₂'} />
      )}
    </>
  );
}

export default function NonParametric() {
  return (
    <CalculatorForm calculator={nonParametric}>
      <Fields />
    </CalculatorForm>
  );
}
