'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { TextAreaField } from '@/components/calculators/form/fields';
import { separable } from '@/lib/calculators/programacion-no-lineal/programacion-separable';
import { ConstraintsField, ObjectiveField, SenseField } from './NlpFields';

export default function Separable() {
  return (
    <CalculatorForm calculator={separable}>
      <SenseField />
      <ObjectiveField prefix="z =" />
      <ConstraintsField hint="Sumas de funciones de una sola variable, p. ej. 3x1 + 2x2^2 <= 9. La no negatividad se asume." />
      <TextAreaField
        name="breakpoints"
        label="Puntos de quiebre"
        rows={3}
        hint="Una línea por variable no lineal, p. ej. «x2: 0, 1, 2, 3». Las variables que solo aparecen en forma lineal no se aproximan."
      />
    </CalculatorForm>
  );
}
