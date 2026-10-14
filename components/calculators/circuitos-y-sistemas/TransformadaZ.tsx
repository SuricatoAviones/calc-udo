'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  ExpressionField,
  NumberField,
  SelectField,
  TextField,
} from '@/components/calculators/form/fields';
import { signalTex } from '@/lib/calculators/circuitos-y-sistemas/signal';
import { transformadaZ } from '@/lib/calculators/circuitos-y-sistemas/transformada-z';

const SEQUENCE_HINT = (
  <>
    Usa <code>k</code>: <code>0.5^k</code>, <code>(-1)^k</code>, <code>k e^(-k)</code>,{' '}
    <code>cos(2k)</code>, el escalón <code>u(k-2)</code> y el impulso <code>delta(k)</code>.
  </>
);

function Fields() {
  const { control } = useFormContext();
  const mode = useWatch({ control, name: 'mode' }) as 'sucesion' | 'inversa' | 'ecuacion';
  return (
    <>
      {mode === 'inversa' ? (
        <ExpressionField
          name="expression"
          label="X(z)"
          variables={['z']}
          previewPrefix="X(z) ="
          hint={
            <>
              Cociente de polinomios en <code>z</code>: <code>z/((z - 1)(z - 0.5))</code>. También
              admite potencias negativas: <code>1 + 2z^(-1)</code>.
            </>
          }
        />
      ) : (
        <ExpressionField
          name="expression"
          label={mode === 'ecuacion' ? 'Excitación x(k) (lado derecho)' : 'Sucesión x(k)'}
          hint={SEQUENCE_HINT}
          previewPrefix="x(k) ="
          toTex={signalTex}
        />
      )}
      {mode === 'ecuacion' && (
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
                De y(k + n) a y(k): <code>1 0.5 0.2</code> es y(k + 2) + 0.5y(k + 1) + 0.2y(k).
              </>
            }
            placeholder="1 0.5 0.2"
          />
          <TextField
            name="initial"
            label={
              <>
                Valores iniciales <Formula tex="y(0)\ y(1)\ \ldots" />
              </>
            }
            hint="Tantos como el orden. Vacío = todos 0."
            placeholder="0 0"
          />
        </>
      )}
      <NumberField name="samples" label="Muestras en la tabla" integer />
    </>
  );
}

export default function TransformadaZ() {
  return (
    <CalculatorForm calculator={transformadaZ}>
      <SelectField
        name="mode"
        label="Qué hacer"
        options={[
          { value: 'sucesion', label: 'Transformar una sucesión x(k)' },
          { value: 'inversa', label: 'Invertir X(z)' },
          { value: 'ecuacion', label: 'Resolver una ecuación en diferencias' },
        ]}
      />
      <Fields />
    </CalculatorForm>
  );
}
