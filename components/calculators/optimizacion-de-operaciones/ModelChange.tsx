'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField, TextField } from '@/components/calculators/form/fields';
import {
  modelChange,
  type ChangeType,
} from '@/lib/calculators/optimizacion-de-operaciones/cambios-en-el-modelo';
import { LpFields } from './LpFields';

const HINTS: Record<ChangeType, string> = {
  'lado-derecho': 'Nuevas disponibilidades de los recursos: cambia la factibilidad.',
  objetivo: 'Nuevos precios o costos: cambia la optimalidad.',
  'coeficientes-tecnologicos': 'Nueva columna de una variable (lo que consume de cada recurso).',
  'nueva-variable': 'Una actividad o producto nuevo con su columna y su aporte a z.',
  'nueva-restriccion': 'Un recurso o condición adicional.',
};

function ChangeFields() {
  const { control } = useFormContext();
  const change = (useWatch({ control, name: 'change' }) as ChangeType | undefined) ?? 'objetivo';
  return (
    <>
      <SelectField
        name="change"
        label="¿Qué cambia?"
        hint={HINTS[change]}
        options={[
          { value: 'lado-derecho', label: 'Lado derecho (recursos)' },
          { value: 'objetivo', label: 'Coeficientes de la función objetivo' },
          {
            value: 'coeficientes-tecnologicos',
            label: 'Coeficientes tecnológicos de una variable',
          },
          { value: 'nueva-variable', label: 'Nueva variable (actividad)' },
          { value: 'nueva-restriccion', label: 'Nueva restricción' },
        ]}
      />
      {change === 'lado-derecho' && (
        <TextField
          name="rhs"
          label={
            <>
              Nuevo lado derecho <Formula tex="b'" />
            </>
          }
          placeholder="600 640 590"
        />
      )}
      {change === 'objetivo' && (
        <TextField
          name="newObjective"
          label="Nueva función objetivo"
          placeholder="2x1 + 3x2 + 4x3"
        />
      )}
      {change === 'nueva-restriccion' && (
        <TextField
          name="constraint"
          label="Restricción nueva"
          placeholder="3x1 + 3x2 + x3 <= 500"
        />
      )}
      {(change === 'coeficientes-tecnologicos' || change === 'nueva-variable') && (
        <div className="grid grid-cols-2 gap-3">
          {change === 'coeficientes-tecnologicos' && (
            <TextField name="variable" label="Variable" placeholder="x1" />
          )}
          <TextField
            name="cost"
            label={
              change === 'nueva-variable' ? (
                <>
                  Coeficiente en <Formula tex="z" />
                </>
              ) : (
                <>
                  Nuevo <Formula tex="c_j" /> (opcional)
                </>
              )
            }
            placeholder="4"
          />
          <TextField
            name="column"
            label="Columna (un coeficiente por restricción)"
            placeholder="1 1 2"
            className="col-span-2"
          />
        </div>
      )}
    </>
  );
}

export default function ModelChange() {
  return (
    <CalculatorForm calculator={modelChange}>
      <LpFields constraintsHint="El modelo original: una restricción por línea, con <= y lado derecho no negativo (el análisis parte de la tabla óptima con holguras)." />
      <ChangeFields />
    </CalculatorForm>
  );
}
