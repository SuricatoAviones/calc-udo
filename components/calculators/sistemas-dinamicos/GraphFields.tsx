'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { SelectField } from '@/components/calculators/form/fields';
import { BlockDiagramField } from './BlockDiagramField';
import { GraphEndsFields } from './fields';
import { SignalFlowField } from './SignalFlowField';

/** Diagrama de bloques dibujado o flujograma escrito como lista de ramas, con su entrada y salida. */
export function GraphFields() {
  const { control } = useFormContext();
  const mode = useWatch({ control, name: 'mode' }) as 'diagrama' | 'flujograma';
  return (
    <>
      <SelectField
        name="mode"
        label="Sistema"
        options={[
          { value: 'diagrama', label: 'Diagrama de bloques (dibujarlo)' },
          { value: 'flujograma', label: 'Flujograma (lista de ramas)' },
        ]}
      />
      {mode === 'diagrama' ? <BlockDiagramField name="diagram" /> : <SignalFlowField />}
      <GraphEndsFields />
    </>
  );
}
