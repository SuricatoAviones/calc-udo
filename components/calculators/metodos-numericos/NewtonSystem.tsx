'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  ExpressionField,
  IterationFields,
  NumberField,
  SelectField,
} from '@/components/calculators/form/fields';
import { newtonSystem } from '@/lib/calculators/metodos-numericos/newton-varias-variables';

function Fields() {
  const { control } = useFormContext();
  const three = useWatch({ control, name: 'size' }) === '3';
  const variables = three ? ['x', 'y', 'z'] : ['x', 'y'];
  const args = variables.join(', ');
  return (
    <>
      <SelectField
        name="size"
        label="Número de ecuaciones"
        options={[
          { value: '2', label: '2 ecuaciones: x, y' },
          { value: '3', label: '3 ecuaciones: x, y, z' },
        ]}
      />
      <ExpressionField
        name="f1"
        variables={variables}
        label={<Formula tex={`f_1(${args}) = 0`} />}
        previewPrefix={`f_1(${args}) =`}
        hint={
          <>
            Escribe cada ecuación igualada a 0. Ej.: <code>x^2 + x*y - 10</code>.
          </>
        }
      />
      <ExpressionField
        name="f2"
        variables={variables}
        label={<Formula tex={`f_2(${args}) = 0`} />}
        previewPrefix={`f_2(${args}) =`}
      />
      {three && (
        <ExpressionField
          name="f3"
          variables={variables}
          label={<Formula tex={`f_3(${args}) = 0`} />}
          previewPrefix={`f_3(${args}) =`}
        />
      )}
      <div className={three ? 'grid grid-cols-3 gap-3' : 'grid grid-cols-2 gap-3'}>
        <NumberField name="x0" label={<Formula tex="x_0" />} />
        <NumberField name="y0" label={<Formula tex="y_0" />} />
        {three && <NumberField name="z0" label={<Formula tex="z_0" />} optional />}
      </div>
      <IterationFields />
    </>
  );
}

export default function NewtonSystem() {
  return (
    <CalculatorForm calculator={newtonSystem}>
      <Fields />
    </CalculatorForm>
  );
}
