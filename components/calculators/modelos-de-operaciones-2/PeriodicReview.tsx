'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { periodicReview } from '@/lib/calculators/modelos-de-operaciones-2/revision-periodica';

export default function PeriodicReview() {
  return (
    <CalculatorForm calculator={periodicReview}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="demand"
          label={
            <>
              Demanda por periodo <Formula tex="\bar d" />
            </>
          }
        />
        <NumberField
          name="sigma"
          label={
            <>
              Desviación <Formula tex="\sigma_d" />
            </>
          }
        />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="review"
          label={
            <>
              Revisión cada <Formula tex="T" />
            </>
          }
        />
        <NumberField
          name="leadTime"
          label={
            <>
              Tiempo de entrega <Formula tex="L" />
            </>
          }
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Todo en la misma unidad de tiempo (p. ej. días): demanda diaria, T y L en días.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="serviceLevel"
          label={
            <>
              Probabilidad de servicio <Formula tex="P" />
            </>
          }
          hint="Ej.: 0.98 para cubrir el 98 % de la demanda."
        />
        <NumberField
          name="onHand"
          label={
            <>
              Inventario actual <Formula tex="I" />
            </>
          }
          hint="Incluye lo ya pedido."
        />
      </div>
    </CalculatorForm>
  );
}
