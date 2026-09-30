'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { birthDeath } from '@/lib/calculators/procesos-estocasticos/nacimiento-y-muerte';

export default function BirthDeath() {
  return (
    <CalculatorForm calculator={birthDeath}>
      <TableField
        name="segments"
        label="Tasas por tramos de estados"
        rowName="tramo"
        max={20}
        columns={[
          { key: 'from', header: 'Desde n', ariaLabel: 'Desde el estado', kind: 'number' },
          {
            key: 'lambda',
            header: <Formula tex="\lambda_n" />,
            ariaLabel: 'Tasa de nacimientos',
            kind: 'number',
          },
          {
            key: 'mu',
            header: <Formula tex="\mu_n" />,
            ariaLabel: 'Tasa de muertes',
            kind: 'number',
          },
        ]}
        newRow={() => ({ from: undefined, lambda: undefined, mu: undefined })}
        hint="Cada fila vale desde su estado hasta el anterior a la fila siguiente; la primera empieza en 0. Ej.: con 3 cajas que abren según la cola, μ = 5, 10 y 15 desde n = 0, 4 y 7."
      />
      <NumberField
        name="capacity"
        label="Capacidad máxima K (opcional)"
        optional
        integer
        hint="Vacío = sin límite: el último tramo sigue para siempre y necesita λ < μ."
      />
    </CalculatorForm>
  );
}
