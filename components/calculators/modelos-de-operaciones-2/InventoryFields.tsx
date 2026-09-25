'use client';

import { Formula } from '@/components/calculators/Formula';
import { NumberField } from '@/components/calculators/form/fields';

/** Demanda D y costo de pedir K, comunes a los modelos de EOQ. */
export function DemandAndOrderCostFields() {
  return (
    <div className="grid grid-cols-2 gap-3">
      <NumberField
        name="demand"
        label={
          <>
            Demanda <Formula tex="D" />
          </>
        }
        hint="Unidades por unidad de tiempo."
      />
      <NumberField
        name="orderCost"
        label={
          <>
            Costo de pedir <Formula tex="K" />
          </>
        }
        hint="Por pedido o preparación."
      />
    </div>
  );
}

export function HoldingCostField() {
  return (
    <NumberField
      name="holdingCost"
      label={
        <>
          Costo de mantener <Formula tex="h" />
        </>
      }
      hint="Por unidad y por unidad de tiempo, en la misma unidad de tiempo que D."
    />
  );
}

export function LeadTimeField() {
  return (
    <NumberField
      name="leadTime"
      optional
      label={
        <>
          Tiempo de entrega <Formula tex="L" />
        </>
      }
      hint="Opcional: para calcular el punto de reorden."
    />
  );
}
