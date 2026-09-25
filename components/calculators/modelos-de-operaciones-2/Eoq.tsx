'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { eoq } from '@/lib/calculators/modelos-de-operaciones-2/eoq';
import { DemandAndOrderCostFields, HoldingCostField, LeadTimeField } from './InventoryFields';

export default function Eoq() {
  return (
    <CalculatorForm calculator={eoq}>
      <DemandAndOrderCostFields />
      <HoldingCostField />
      <LeadTimeField />
    </CalculatorForm>
  );
}
