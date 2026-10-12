'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { SelectField } from '@/components/calculators/form/fields';
import {
  componentLabel,
  componentUnit,
  type CircuitDocument,
} from '@/lib/calculators/circuitos-y-sistemas/circuit';

/**
 * Selector de la resistencia de carga: lee el circuito del formulario y lista sus componentes para
 * elegir entre cuyos terminales se busca el equivalente de Thévenin/Norton.
 */
export function LoadSelectField() {
  const { control } = useFormContext();
  const circuit = useWatch({ control, name: 'circuit' }) as CircuitDocument | undefined;
  const options = (circuit?.components ?? []).map((c) => ({
    value: c.id,
    label: `${componentLabel(c)} · ${componentUnit(c.kind)}`,
  }));
  return (
    <SelectField
      name="load"
      label="Resistencia de carga"
      hint="El equivalente se calcula entre los terminales de este componente."
      options={options}
    />
  );
}
