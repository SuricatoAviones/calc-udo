'use client';

import { NumberField, SelectField } from '@/components/calculators/form/fields';

/**
 * Hipótesis alternativa y nivel de significancia, comunes a las pruebas de hipótesis. `parameter`
 * y `value` son el texto de H₁ (p. ej. «μ» y «μ₀»).
 */
export function TestFields({
  parameter,
  value,
  withAlpha = true,
}: {
  parameter: string;
  value: string;
  withAlpha?: boolean;
}) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      <SelectField
        name="alternative"
        label="Hipótesis alternativa H₁"
        options={[
          { value: 'distinto', label: `${parameter} ≠ ${value} (bilateral)` },
          { value: 'menor', label: `${parameter} < ${value} (cola izquierda)` },
          { value: 'mayor', label: `${parameter} > ${value} (cola derecha)` },
        ]}
      />
      {withAlpha && (
        <NumberField
          name="alpha"
          label="Nivel de significancia α"
          hint="Por ejemplo 0.05 o 0.01."
        />
      )}
    </div>
  );
}
