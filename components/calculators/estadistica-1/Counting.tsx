'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField, TextField } from '@/components/calculators/form/fields';
import { counting, type CountingType } from '@/lib/calculators/estadistica-1/tecnicas-de-conteo';

const HINTS: Record<CountingType, string> = {
  permutaciones: 'Importa el orden y no se repite: presidente y tesorero entre 50 personas.',
  combinaciones: 'No importa el orden: elegir 3 cartuchos de 10.',
  'con-repeticion': 'Cada posición puede repetir objeto: lanzar 2 dados (6²).',
  circulares: 'n objetos alrededor de una mesa.',
  'objetos-repetidos': 'Letras de STATISTICS: 3 S, 3 T, 2 I, 1 A, 1 C.',
  particiones: '7 personas en una habitación triple y dos dobles: 3 2 2.',
};

function CountingFields() {
  const { control } = useFormContext();
  const type = (useWatch({ control, name: 'type' }) as CountingType | undefined) ?? 'permutaciones';
  const groups = type === 'objetos-repetidos' || type === 'particiones';
  const withR = type === 'permutaciones' || type === 'combinaciones' || type === 'con-repeticion';
  return (
    <>
      <SelectField
        name="type"
        label="¿Qué quieres contar?"
        hint={HINTS[type]}
        options={[
          { value: 'permutaciones', label: 'Permutaciones ₙPᵣ' },
          { value: 'combinaciones', label: 'Combinaciones C(n, r)' },
          { value: 'con-repeticion', label: 'Arreglos con repetición nʳ' },
          { value: 'circulares', label: 'Permutaciones circulares' },
          { value: 'objetos-repetidos', label: 'Permutaciones con objetos repetidos' },
          { value: 'particiones', label: 'Particiones en celdas' },
        ]}
      />
      {groups ? (
        <TextField
          name="groups"
          label={type === 'particiones' ? 'Elementos por celda' : 'Objetos de cada clase'}
          placeholder="3 3 2 1 1"
        />
      ) : (
        <div className="grid grid-cols-2 gap-3">
          <NumberField name="n" label="Objetos n" integer optional />
          {withR && <NumberField name="r" label="Tomados r" integer optional />}
        </div>
      )}
    </>
  );
}

export default function Counting() {
  return (
    <CalculatorForm calculator={counting}>
      <CountingFields />
    </CalculatorForm>
  );
}
