'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { reduccionDeDiagramasDeBloques } from '@/lib/calculators/sistemas-dinamicos/reduccion-de-diagramas-de-bloques';
import { GraphFields } from './GraphFields';

export default function ReduccionDeDiagramasDeBloques() {
  return (
    <CalculatorForm calculator={reduccionDeDiagramasDeBloques}>
      <GraphFields />
    </CalculatorForm>
  );
}
