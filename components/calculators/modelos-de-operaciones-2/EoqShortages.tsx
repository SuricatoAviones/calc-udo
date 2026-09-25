'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { eoqShortages } from '@/lib/calculators/modelos-de-operaciones-2/eoq-con-faltantes';
import { DemandAndOrderCostFields, HoldingCostField } from './InventoryFields';

export default function EoqShortages() {
  return (
    <CalculatorForm calculator={eoqShortages}>
      <DemandAndOrderCostFields />
      <HoldingCostField />
      <NumberField
        name="shortageCost"
        label={
          <>
            Costo por faltante <Formula tex="p" />
          </>
        }
        hint="Por unidad pendiente y por unidad de tiempo."
      />
    </CalculatorForm>
  );
}
