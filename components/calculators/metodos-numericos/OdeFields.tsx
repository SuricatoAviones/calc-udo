'use client';

import { Formula } from '@/components/calculators/Formula';
import { ExpressionField, NumberField } from '@/components/calculators/form/fields';

/** Campos comunes de los métodos para EDO de valor inicial. */
export function OdeFields() {
  return (
    <>
      <ExpressionField
        name="expression"
        variables={['x', 'y']}
        label={
          <>
            <Formula tex="\dfrac{dy}{dx} = f(x, y)" />
          </>
        }
        previewPrefix="\frac{dy}{dx} ="
        hint={
          <>
            Usa <code>x</code> e <code>y</code>. Ej.: <code>4 e^(0.8x) - 0.5y</code>,{' '}
            <code>x + y</code>, <code>-2x^3 + 12x^2 - 20x + 8.5</code>.
          </>
        }
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="x0" label={<Formula tex="x_0" />} />
        <NumberField name="y0" label={<Formula tex="y_0 = y(x_0)" />} />
        <NumberField name="h" label="Tamaño de paso h" />
        <NumberField name="xf" label={<>x final</>} />
      </div>
      <ExpressionField
        name="exact"
        optional
        label="Solución exacta y(x) (opcional)"
        previewPrefix="y(x) ="
        hint="Si la conoces, se compara en cada paso y se grafica junto a la aproximación."
      />
    </>
  );
}
