'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { TableField, type TableFieldColumn } from '@/components/calculators/form/TableField';
import { geometric } from '@/lib/calculators/programacion-no-lineal/programacion-geometrica';

const exponentColumn = (j: number): TableFieldColumn => ({
  key: `a${j}`,
  header: <Formula tex={`a_{i${j}}`} />,
  ariaLabel: `Exponente de x${j}`,
  kind: 'number',
  optional: true,
  minWidth: 3.5,
  placeholder: '0',
});

export default function Geometric() {
  return (
    <CalculatorForm calculator={geometric}>
      <TableField
        name="terms"
        label={
          <>
            Términos <Formula tex="c_i\,x_1^{a_{i1}} x_2^{a_{i2}} x_3^{a_{i3}} x_4^{a_{i4}}" />
          </>
        }
        rowName="término"
        max={12}
        columns={[
          {
            key: 'fn',
            header: 'Función',
            ariaLabel: 'Función',
            kind: 'number',
            minWidth: 3.5,
          },
          {
            key: 'c',
            header: <Formula tex="c_i" />,
            ariaLabel: 'Coeficiente',
            kind: 'number',
            minWidth: 4,
          },
          exponentColumn(1),
          exponentColumn(2),
          exponentColumn(3),
          exponentColumn(4),
        ]}
        newRow={() => ({
          fn: 0,
          c: undefined,
          a1: undefined,
          a2: undefined,
          a3: undefined,
          a4: undefined,
        })}
        hint="Función 0 = objetivo (a minimizar); 1, 2, … = restricciones g_k(x) ≤ 1. Exponente vacío = 0. Ej.: 40/(x1 x2 x3) es c = 40 con exponentes −1, −1, −1."
      />
    </CalculatorForm>
  );
}
