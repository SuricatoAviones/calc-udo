'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { TextField } from '@/components/calculators/form/fields';
import { branchAndBound } from '@/lib/calculators/optimizacion-de-operaciones/ramificacion-y-acotamiento';
import { LpFields } from './LpFields';

export default function BranchAndBound() {
  return (
    <CalculatorForm calculator={branchAndBound}>
      <LpFields />
      <TextField
        name="integers"
        label="Variables enteras"
        placeholder="todas"
        hint="Sepáralas con comas (x1, x3) para un modelo mixto. Déjalo vacío si todas deben ser enteras."
      />
    </CalculatorForm>
  );
}
