'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { productionLot } from '@/lib/calculators/modelos-de-operaciones-2/lote-economico-de-produccion';

export default function ProductionLot() {
  return (
    <CalculatorForm calculator={productionLot}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="demand"
          label={
            <>
              Demanda anual <Formula tex="D" />
            </>
          }
        />
        <NumberField
          name="production"
          label={
            <>
              Producción anual <Formula tex="P" />
            </>
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="setupCost"
          label={
            <>
              Preparación <Formula tex="C_o" />
            </>
          }
        />
        <NumberField
          name="holdingCost"
          label={
            <>
              Mantener <Formula tex="C_h" />
            </>
          }
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        P es lo que se produciría en un año produciendo todos los días. C_h es por unidad y por año
        (p. ej. 24 % de un costo de $4.50 es 1.08).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="workingDays" label="Días hábiles por año (opcional)" optional />
        <NumberField name="leadTime" label="Tiempo de preparación en días (opcional)" optional />
      </div>
    </CalculatorForm>
  );
}
