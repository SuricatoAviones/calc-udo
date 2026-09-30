'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextAreaField } from '@/components/calculators/form/fields';
import { varianceTest } from '@/lib/calculators/estadistica-2/prueba-de-hipotesis-varianza';
import { TestFields } from './TestFields';

function Fields() {
  const { control } = useFormContext();
  const two = useWatch({ control, name: 'mode' }) === 'dos';
  const fromData = useWatch({ control, name: 'source' }) === 'datos';
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          name="mode"
          label="Prueba"
          options={[
            { value: 'una', label: 'Una varianza (ji-cuadrada)' },
            { value: 'dos', label: 'Dos varianzas (F)' },
          ]}
        />
        <SelectField
          name="source"
          label={two ? 'Las muestras' : 'La muestra'}
          options={[
            { value: 'resumen', label: 'Tengo n y s' },
            { value: 'datos', label: 'Tengo los datos' },
          ]}
        />
      </div>
      {fromData ? (
        <div className={two ? 'grid grid-cols-1 gap-3 sm:grid-cols-2' : ''}>
          <TextAreaField
            name="data1"
            label={two ? 'Datos de la muestra 1' : 'Datos de la muestra'}
          />
          {two && <TextAreaField name="data2" label="Datos de la muestra 2" />}
        </div>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="n1" label={two ? 'n₁' : 'Tamaño n'} integer optional />
          <NumberField name="s1" label={two ? 's₁' : 'Desviación estándar s'} optional />
          {two && <NumberField name="n2" label="n₂" integer optional />}
          {two && <NumberField name="s2" label="s₂" optional />}
        </div>
      )}
      {!two && (
        <NumberField
          name="sigma0"
          optional
          label={<Formula tex="\sigma_0 \text{ (desviación estándar de } H_0)" />}
          hint="H₀: σ² = σ₀². Si el enunciado da la varianza, escribe su raíz cuadrada."
        />
      )}
      <TestFields parameter={two ? 'σ₁²' : 'σ²'} value={two ? 'σ₂²' : 'σ₀²'} />
    </>
  );
}

export default function VarianceTest() {
  return (
    <CalculatorForm calculator={varianceTest}>
      <Fields />
    </CalculatorForm>
  );
}
