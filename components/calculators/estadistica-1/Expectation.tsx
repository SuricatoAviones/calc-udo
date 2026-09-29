'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField, SelectField, TextField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { expectation } from '@/lib/calculators/estadistica-1/esperanza-y-varianza';

function DistributionFields() {
  const { control } = useFormContext();
  const continuous = useWatch({ control, name: 'type' }) === 'continua';
  return (
    <>
      <SelectField
        name="type"
        label="Variable aleatoria"
        options={[
          { value: 'discreta', label: 'Discreta: tabla de x y f(x)' },
          { value: 'continua', label: 'Continua: función de densidad f(x)' },
        ]}
      />
      {continuous ? (
        <>
          <ExpressionField
            name="density"
            label={
              <>
                Densidad <Formula tex="f(x)" />
              </>
            }
            previewPrefix="f(x) ="
            hint={
              <>
                Solo la parte distinta de 0. Ej.: <code>2(x - 1)</code>, <code>20000/x^3</code>,{' '}
                <code>0.5 e^(-0.5 x)</code>.
              </>
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <TextField name="lower" label="Desde x =" placeholder="0" />
            <TextField name="upper" label="Hasta x =" placeholder="inf" />
          </div>
          <p className="text-muted-foreground -mt-2 text-xs">
            Escribe <code>inf</code> o <code>-inf</code> para un límite infinito.
          </p>
        </>
      ) : (
        <TableField
          name="values"
          label="Distribución de probabilidad"
          rowName="valor"
          min={1}
          max={50}
          columns={[
            { key: 'x', header: <Formula tex="x" />, ariaLabel: 'Valor x', kind: 'number' },
            {
              key: 'p',
              header: <Formula tex="f(x)" />,
              ariaLabel: 'Probabilidad',
              kind: 'text',
              minWidth: 5,
              placeholder: '12/35',
            },
          ]}
          newRow={() => ({ x: undefined, p: '' })}
          hint="f(x) acepta decimales o fracciones (12/35) y deben sumar 1."
        />
      )}
    </>
  );
}

export default function Expectation() {
  return (
    <CalculatorForm calculator={expectation}>
      <DistributionFields />
    </CalculatorForm>
  );
}
