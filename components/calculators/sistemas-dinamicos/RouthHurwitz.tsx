'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField } from '@/components/calculators/form/fields';
import { routhHurwitz } from '@/lib/calculators/sistemas-dinamicos/routh-hurwitz';
import { gainPreviewTex } from '@/lib/calculators/sistemas-dinamicos/symbolic';

export default function RouthHurwitz() {
  return (
    <CalculatorForm calculator={routhHurwitz}>
      <ExpressionField
        name="polynomial"
        label="Ecuación característica"
        variables={['s', 'K']}
        previewPrefix=""
        toTex={(source) => {
          const tex = gainPreviewTex(source);
          return tex ? `${tex} = 0` : null;
        }}
        hint={
          <>
            Polinomio en <code>s</code>, desarrollado o factorizado:{' '}
            <code>s^4 + 2s^3 + 3s^2 + 4s + 5</code>. Puede tener un parámetro para hallar su
            intervalo de estabilidad: <code>s(s + 1)(s + 2) + K</code>.
          </>
        }
      />
    </CalculatorForm>
  );
}
