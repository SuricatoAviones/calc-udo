'use client';

import {
  ExpressionField,
  SelectField,
  TextAreaField,
  TextField,
} from '@/components/calculators/form/fields';
import { NLP_HINT, NLP_VARIABLES } from '@/lib/calculators/programacion-no-lineal/nlp';

/** Función objetivo de x1, x2, … con vista previa. */
export function ObjectiveField({
  name = 'objective',
  label = 'Función objetivo',
  prefix = 'f(X) =',
}: {
  name?: string;
  label?: string;
  prefix?: string;
}) {
  return (
    <ExpressionField
      name={name}
      label={label}
      variables={NLP_VARIABLES}
      previewPrefix={prefix}
      hint={NLP_HINT}
    />
  );
}

/** Maximizar o minimizar. */
export function SenseField() {
  return (
    <SelectField
      name="sense"
      label="Objetivo"
      options={[
        { value: 'max', label: 'Maximizar' },
        { value: 'min', label: 'Minimizar' },
      ]}
    />
  );
}

/** Restricciones, una por línea. */
export function ConstraintsField({ hint }: { hint?: string }) {
  return (
    <TextAreaField
      name="constraints"
      label="Restricciones (una por línea)"
      rows={4}
      hint={hint ?? 'Escribe cada restricción con <=, >= o =, p. ej. 2x1 + x2^2 <= 5.'}
    />
  );
}

/** Punto (x1, x2, …) como lista de números. */
export function PointField({ name, label, hint }: { name: string; label: string; hint?: string }) {
  return <TextField name={name} label={label} hint={hint} placeholder="1, 2, 0" />;
}
