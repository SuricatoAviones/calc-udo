'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { TableField } from '@/components/calculators/form/TableField';
import { bayes } from '@/lib/calculators/estadistica-1/teorema-de-bayes';

export default function Bayes() {
  return (
    <CalculatorForm calculator={bayes}>
      <TableField
        name="events"
        label="Partición B₁, …, Bₖ y el evento observado A"
        rowName="evento"
        min={2}
        max={10}
        columns={[
          { key: 'name', header: 'Evento Bᵢ', ariaLabel: 'Evento', kind: 'text', minWidth: 6 },
          {
            key: 'prior',
            header: <Formula tex="P(B_i)" />,
            ariaLabel: 'Probabilidad a priori',
            kind: 'text',
            minWidth: 4.5,
            placeholder: '0.3',
          },
          {
            key: 'likelihood',
            header: <Formula tex="P(A \mid B_i)" />,
            ariaLabel: 'Probabilidad de A dado el evento',
            kind: 'text',
            minWidth: 4.5,
            placeholder: '0.02',
          },
        ]}
        newRow={(count) => ({ name: `B${count + 1}`, prior: '', likelihood: '' })}
        hint="Acepta decimales o fracciones (1/3). Las P(Bᵢ) deben sumar 1; A es lo que se observó (p. ej. «el producto está defectuoso»)."
      />
    </CalculatorForm>
  );
}
