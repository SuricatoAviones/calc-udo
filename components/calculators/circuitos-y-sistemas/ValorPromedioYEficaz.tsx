'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { valorPromedioYEficaz } from '@/lib/calculators/circuitos-y-sistemas/valor-promedio-y-eficaz';

export default function ValorPromedioYEficaz() {
  return (
    <CalculatorForm calculator={valorPromedioYEficaz}>
      <SelectField
        name="quantity"
        label="Señal"
        options={[
          { value: 'voltaje', label: 'Voltaje v(t) (V)' },
          { value: 'corriente', label: 'Corriente i(t) (A)' },
        ]}
      />
      <TableField
        name="segments"
        label="Un periodo de la señal, por tramos"
        hint={
          <>
            Cada tramo empieza donde termina el anterior (el primero en t = 0); el último fija el
            periodo T. Los finales admiten <code>pi</code>: <code>2*pi/25</code>. Ej.:{' '}
            <code>6cos(25t)</code>, <code>3t</code>, <code>10sin(377t)</code>.
          </>
        }
        columns={[
          {
            key: 'end',
            header: 'Hasta t =',
            ariaLabel: 'Final del tramo',
            kind: 'text',
            minWidth: 6,
            placeholder: '1',
          },
          {
            key: 'expression',
            header: <Formula tex="f(t)" />,
            ariaLabel: 'Expresión del tramo',
            kind: 'text',
            minWidth: 12,
            placeholder: '5',
          },
        ]}
        newRow={(count) => ({ end: String(count + 1), expression: '0' })}
        rowName="tramo"
        min={1}
        max={8}
      />
      <NumberField
        name="resistance"
        label="Resistencia R (Ω), opcional"
        hint="Para calcular la potencia promedio que la señal entrega a R."
        optional
      />
    </CalculatorForm>
  );
}
