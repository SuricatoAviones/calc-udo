'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField } from '@/components/calculators/form/fields';
import { modi } from '@/lib/calculators/optimizacion-de-operaciones/metodo-de-multiplicadores';
import { TransportTableField } from './TransportTableField';

export default function Modi() {
  return (
    <CalculatorForm calculator={modi}>
      <TransportTableField />
      <SelectField
        name="initial"
        label="Solución inicial"
        options={[
          { value: 'esquina-noroeste', label: 'Esquina noroeste' },
          { value: 'costo-minimo', label: 'Costo mínimo' },
          { value: 'vogel', label: 'Aproximación de Vogel' },
        ]}
        hint="Desde cualquiera se llega al mismo costo óptimo; cambia el número de iteraciones."
      />
    </CalculatorForm>
  );
}
