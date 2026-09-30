'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextAreaField } from '@/components/calculators/form/fields';
import { meanTest } from '@/lib/calculators/estadistica-2/prueba-de-hipotesis-media';
import { TestFields } from './TestFields';

function Fields() {
  const { control } = useFormContext();
  const fromData = useWatch({ control, name: 'source' }) === 'datos';
  const known = useWatch({ control, name: 'variance' }) === 'conocida';
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          name="source"
          label="La muestra"
          options={[
            { value: 'resumen', label: 'Tengo n, x̄ y la desviación' },
            { value: 'datos', label: 'Tengo los datos' },
          ]}
        />
        <SelectField
          name="variance"
          label="Desviación estándar de la población"
          options={[
            { value: 'conocida', label: 'σ conocida (prueba z)' },
            { value: 'desconocida', label: 'σ desconocida (prueba t)' },
          ]}
        />
      </div>
      {fromData ? (
        <TextAreaField
          name="data"
          label="Datos de la muestra"
          hint="Separados por espacios, saltos de línea o punto y coma."
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="n" label="Tamaño n" integer optional />
          <NumberField name="mean" label={<Formula tex="\bar{x}" />} optional />
        </div>
      )}
      {(known || !fromData) && (
        <NumberField
          name="sd"
          optional
          label={
            known ? 'Desviación estándar σ de la población' : 'Desviación estándar s de la muestra'
          }
        />
      )}
      <NumberField name="mu0" label={<Formula tex="\mu_0 \text{ (valor de } H_0)" />} />
      <TestFields parameter="μ" value="μ₀" />
    </>
  );
}

export default function MeanTest() {
  return (
    <CalculatorForm calculator={meanTest}>
      <Fields />
    </CalculatorForm>
  );
}
