'use client';

import { useEffect } from 'react';
import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { MatrixField } from '@/components/calculators/form/MatrixField';
import { jackson } from '@/lib/calculators/teoria-de-colas/redes-de-jackson';
import { StationsField } from './StationsField';

/** Matriz de rutas del mismo tamaño que la tabla de estaciones. */
function RoutingField() {
  const { control, getValues, setValue } = useFormContext();
  const stations = useWatch({ control, name: 'stations' }) as unknown[] | undefined;
  const size = stations?.length ?? 0;

  useEffect(() => {
    const routing = (getValues('routing') as number[][] | undefined) ?? [];
    if (routing.length === size && routing.every((row) => row.length === size)) return;
    setValue(
      'routing',
      Array.from({ length: size }, (_, i) =>
        Array.from({ length: size }, (_, j) => routing[i]?.[j] ?? 0),
      ),
    );
  }, [size, getValues, setValue]);

  if (size === 0) return null;
  return (
    <MatrixField
      name="routing"
      min={size}
      max={size}
      unit={size === 1 ? 'estación' : 'estaciones'}
      item="una estación"
      label={
        <>
          Matriz de rutas <Formula tex="p_{ij}" />
        </>
      }
      hint="Fila i, columna j: probabilidad de que un cliente que sale de la estación i vaya a la j. Lo que falta para 1 en cada fila es la probabilidad de salir de la red. El tamaño sigue a la tabla de estaciones."
    />
  );
}

export default function Jackson() {
  return (
    <CalculatorForm calculator={jackson}>
      <StationsField withExternal />
      <RoutingField />
    </CalculatorForm>
  );
}
