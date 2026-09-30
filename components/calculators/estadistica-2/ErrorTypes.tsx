'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { errorTypes } from '@/lib/calculators/estadistica-2/errores-tipo-i-y-ii';
import { TestFields } from './TestFields';

function Fields() {
  const { control } = useFormContext();
  const binomial = useWatch({ control, name: 'model' }) === 'binomial';
  const regionBy = useWatch({ control, name: 'regionBy' }) as string | undefined;
  const byAlpha = !binomial && regionBy === 'alfa';
  const alternative = useWatch({ control, name: 'alternative' }) as string | undefined;
  const variable = binomial ? 'X' : 'x̄';
  return (
    <>
      <SelectField
        name="model"
        label="Modelo"
        options={[
          { value: 'normal', label: 'Media de una normal con σ conocida' },
          { value: 'binomial', label: 'Proporción (número de éxitos binomial)' },
        ]}
      />
      {binomial ? (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="n" label="Ensayos n" integer />
          <NumberField name="p0" label={<Formula tex="p_0" />} optional />
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-3">
          <NumberField name="mu0" label={<Formula tex="\mu_0" />} optional />
          <NumberField name="sigma" label={<Formula tex="\sigma" />} optional />
          <NumberField name="n" label="n" integer />
        </div>
      )}
      <TestFields
        parameter={binomial ? 'p' : 'μ'}
        value={binomial ? 'p₀' : 'μ₀'}
        withAlpha={false}
      />
      {!binomial && (
        <SelectField
          name="regionBy"
          label="Región crítica"
          options={[
            { value: 'limites', label: 'La doy con valores de x̄' },
            { value: 'alfa', label: 'Calcularla a partir de α' },
          ]}
        />
      )}
      {byAlpha ? (
        <NumberField name="alpha" label="Nivel de significancia α" optional />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {alternative !== 'mayor' && (
            <NumberField
              name="lower"
              optional
              label={`Rechazar si ${variable} <`}
              integer={binomial}
            />
          )}
          {alternative !== 'menor' && (
            <NumberField
              name="upper"
              optional
              label={`Rechazar si ${variable} >`}
              integer={binomial}
            />
          )}
        </div>
      )}
      <NumberField
        name="trueValue"
        optional
        label={
          binomial ? 'Valor de la alternativa p₁ (para β)' : 'Valor de la alternativa μ₁ (para β)'
        }
        hint="Si lo indicas, se calculan β y la potencia en ese valor."
      />
    </>
  );
}

export default function ErrorTypes() {
  return (
    <CalculatorForm calculator={errorTypes}>
      <Fields />
    </CalculatorForm>
  );
}
