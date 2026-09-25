'use client';

import { Formula } from '@/components/calculators/Formula';
import { NumberField } from '@/components/calculators/form/fields';

/** λ y μ, comunes a los modelos de colas de Poisson. */
export function RateFields() {
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="lambda"
          label={
            <>
              Llegadas <Formula tex="\lambda" />
            </>
          }
        />
        <NumberField
          name="mu"
          label={
            <>
              Servicio <Formula tex="\mu" />
            </>
          }
        />
      </div>
      <p className="text-muted-foreground -mt-2 text-xs">
        Tasas en clientes por unidad de tiempo (la misma para ambas). Si te dan el tiempo promedio
        de servicio t, usa μ = 1/t: 10 minutos por cliente son μ = 6 por hora.
      </p>
    </>
  );
}
