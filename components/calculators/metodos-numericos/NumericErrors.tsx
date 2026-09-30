'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import {
  ExpressionField,
  FUNCTION_HINT,
  NumberField,
  SelectField,
} from '@/components/calculators/form/fields';
import {
  numericErrors,
  type ErrorMode,
} from '@/lib/calculators/metodos-numericos/errores-numericos';

function Fields() {
  const { control } = useFormContext();
  const mode = (useWatch({ control, name: 'mode' }) as ErrorMode | undefined) ?? 'taylor';
  return (
    <>
      <SelectField
        name="mode"
        label="¿Qué quieres calcular?"
        options={[
          { value: 'aproximacion', label: 'Error de una aproximación' },
          { value: 'redondeo', label: 'Corte y redondeo a k cifras (error de redondeo)' },
          { value: 'taylor', label: 'Serie de Taylor (error de truncamiento)' },
        ]}
      />
      {mode === 'aproximacion' && (
        <>
          <div className="grid grid-cols-2 gap-3">
            <NumberField name="trueValue" label="Valor verdadero" optional />
            <NumberField name="approximation" label="Aproximación" optional />
          </div>
          <NumberField
            name="significantFigures"
            label="Cifras significativas n (opcional)"
            integer
            optional
            hint="Para comprobar si la aproximación es correcta en n cifras (εs = 0.5 × 10²⁻ⁿ %)."
          />
        </>
      )}
      {mode === 'redondeo' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="value" label="Número" optional />
          <NumberField name="digits" label="Cifras significativas k" integer optional />
        </div>
      )}
      {mode === 'taylor' && (
        <>
          <ExpressionField
            name="expression"
            label={<Formula tex="f(x)" />}
            previewPrefix="f(x) ="
            hint={FUNCTION_HINT}
          />
          <div className="grid grid-cols-3 gap-3">
            <NumberField
              name="xi"
              label={
                <>
                  Expansión <Formula tex="x_i" />
                </>
              }
              optional
            />
            <NumberField name="x" label="Punto x" optional />
            <NumberField name="order" label="Orden máx. n" integer optional />
          </div>
          <NumberField
            name="significantFigures"
            label="Cifras significativas (opcional)"
            integer
            optional
            hint="Si la indicas, la serie se detiene cuando |εa| < εs = 0.5 × 10²⁻ⁿ %."
          />
        </>
      )}
    </>
  );
}

export default function NumericErrors() {
  return (
    <CalculatorForm calculator={numericErrors}>
      <Fields />
    </CalculatorForm>
  );
}
