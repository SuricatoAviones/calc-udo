'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { RectangularMatrixField } from '@/components/calculators/form/MatrixField';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import {
  matrixOperationsCalculator,
  type MatrixOperation,
} from '@/lib/calculators/metodos-numericos/operaciones-con-matrices';

function MatrixInput({ name }: { name: 'A' | 'B' }) {
  return (
    <RectangularMatrixField
      name={name}
      label={
        <>
          Matriz <Formula tex={name} />
        </>
      }
      rowPrefix=""
      colPrefix=""
      rowUnit="filas"
      colUnit="columnas"
      rowItem={`una fila de ${name}`}
      colItem={`una columna de ${name}`}
      max={6}
      cellLabel={(i, j) => `${name}, fila ${i + 1}, columna ${j + 1}`}
    />
  );
}

function Fields() {
  const { control } = useFormContext();
  const operation =
    (useWatch({ control, name: 'operation' }) as MatrixOperation | undefined) ?? 'producto';
  const withB = operation === 'suma' || operation === 'resta' || operation === 'producto';
  return (
    <>
      <SelectField
        name="operation"
        label="Operación"
        options={[
          { value: 'suma', label: 'Suma A + B' },
          { value: 'resta', label: 'Resta A − B' },
          { value: 'escalar', label: 'Producto por un escalar kA' },
          { value: 'producto', label: 'Producto A · B' },
          { value: 'transpuesta', label: 'Transpuesta Aᵀ' },
          { value: 'inversa', label: 'Inversa A⁻¹ (Gauss-Jordan)' },
        ]}
      />
      <MatrixInput name="A" />
      {withB && <MatrixInput name="B" />}
      {operation === 'escalar' && <NumberField name="k" label="Escalar k" />}
    </>
  );
}

export default function MatrixOperations() {
  return (
    <CalculatorForm calculator={matrixOperationsCalculator}>
      <Fields />
    </CalculatorForm>
  );
}
