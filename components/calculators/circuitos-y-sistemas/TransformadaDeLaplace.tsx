'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField, SelectField, TextField } from '@/components/calculators/form/fields';
import { signalTex } from '@/lib/calculators/circuitos-y-sistemas/signal';
import { transformadaDeLaplace } from '@/lib/calculators/circuitos-y-sistemas/transformada-de-laplace';
import { SIGNAL_HINT } from './signal-hint';

function Fields() {
  const { control } = useFormContext();
  const equation = useWatch({ control, name: 'mode' }) === 'ecuacion';
  return (
    <>
      <ExpressionField
        name="expression"
        label={equation ? 'Excitación f(t) (lado derecho)' : 'Función f(t)'}
        hint={SIGNAL_HINT}
        previewPrefix="f(t) ="
        toTex={signalTex}
      />
      {equation && (
        <>
          <TextField
            name="coefficients"
            label={
              <>
                Coeficientes <Formula tex="a_n \ldots a_1\ a_0" />
              </>
            }
            hint={
              <>
                De la derivada mayor a y: <code>2 4</code> es 2y′ + 4y; <code>1 3 2</code> es y″ +
                3y′ + 2y.
              </>
            }
            placeholder="1 3 2"
          />
          <TextField
            name="initial"
            label={
              <>
                Condiciones iniciales <Formula tex="y(0)\ y'(0)\ \ldots" />
              </>
            }
            hint="Tantas como el orden de la ecuación. Vacío = todas 0."
            placeholder="0 0"
          />
        </>
      )}
    </>
  );
}

export default function TransformadaDeLaplace() {
  return (
    <CalculatorForm calculator={transformadaDeLaplace}>
      <SelectField
        name="mode"
        label="Qué hacer"
        options={[
          { value: 'funcion', label: 'Transformar una función f(t)' },
          { value: 'ecuacion', label: 'Resolver una ecuación diferencial' },
        ]}
      />
      <Fields />
    </CalculatorForm>
  );
}
