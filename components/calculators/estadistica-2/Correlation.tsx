'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { correlation } from '@/lib/calculators/estadistica-2/coeficiente-de-correlacion';
import { PointsFields } from '@/components/calculators/metodos-numericos/PointsFields';
import { TestFields } from './TestFields';

function Fields() {
  const { control } = useFormContext();
  const fromData = useWatch({ control, name: 'source' }) === 'datos';
  return (
    <>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <SelectField
          name="source"
          label="Datos"
          options={[
            { value: 'datos', label: 'Tengo los pares (x, y)' },
            { value: 'resumen', label: 'Tengo r y n' },
          ]}
        />
        {fromData && (
          <SelectField
            name="method"
            label="Coeficiente"
            options={[
              { value: 'pearson', label: 'Pearson (asociación lineal)' },
              { value: 'spearman', label: 'Spearman (rangos)' },
            ]}
          />
        )}
      </div>
      {fromData ? (
        <PointsFields />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="r" label={<Formula tex="r" />} optional />
          <NumberField name="n" label="Pares n" integer optional />
        </div>
      )}
      <NumberField
        name="rho0"
        label={<Formula tex="\rho_0 \text{ (valor de } H_0)" />}
        hint="Normalmente 0: ¿hay correlación? Con otro valor se usa la transformación de Fisher."
      />
      <TestFields parameter="ρ" value="ρ₀" />
    </>
  );
}

export default function Correlation() {
  return (
    <CalculatorForm calculator={correlation}>
      <Fields />
    </CalculatorForm>
  );
}
