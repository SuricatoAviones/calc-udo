'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { TableField } from '@/components/calculators/form/TableField';
import { discounts } from '@/lib/calculators/modelos-de-operaciones-2/descuentos-por-cantidad';
import { DemandAndOrderCostFields, LeadTimeField } from './InventoryFields';

function HoldingFields() {
  const { control } = useFormContext();
  const percent = useWatch({ control, name: 'holdingType' }) === 'porcentaje';
  return (
    <div className="grid grid-cols-2 gap-3">
      <SelectField
        name="holdingType"
        label="Costo de mantener"
        options={[
          { value: 'fijo', label: 'Fijo (h)' },
          { value: 'porcentaje', label: '% del precio (I)' },
        ]}
      />
      <NumberField
        name="holding"
        label={percent ? <Formula tex="I\ (\%)" /> : <Formula tex="h" />}
        hint={percent ? 'Tasa por unidad de tiempo.' : 'Por unidad y por unidad de tiempo.'}
      />
    </div>
  );
}

export default function Discounts() {
  return (
    <CalculatorForm calculator={discounts}>
      <DemandAndOrderCostFields />
      <HoldingFields />
      <TableField
        name="tiers"
        label="Niveles de precio"
        rowName="nivel"
        max={8}
        columns={[
          {
            key: 'minQuantity',
            header: 'Desde (unidades)',
            ariaLabel: 'Cantidad mínima',
            kind: 'number',
            minWidth: 6,
          },
          {
            key: 'unitPrice',
            header: (
              <>
                Precio <Formula tex="c_j" />
              </>
            ),
            ariaLabel: 'Precio unitario',
            kind: 'number',
            minWidth: 5,
          },
        ]}
        newRow={() => ({ minQuantity: undefined, unitPrice: undefined })}
        hint="El primer nivel empieza en 0; cada nivel aplica desde su cantidad hasta la del siguiente."
      />
      <LeadTimeField />
    </CalculatorForm>
  );
}
