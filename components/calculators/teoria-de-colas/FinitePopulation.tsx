'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField } from '@/components/calculators/form/fields';
import { finitePopulation } from '@/lib/calculators/teoria-de-colas/poblacion-finita';

export default function FinitePopulation() {
  return (
    <CalculatorForm calculator={finitePopulation}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="lambda"
          label={
            <>
              Llegadas por cliente <Formula tex="\lambda" />
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
        λ es la tasa de cada cliente mientras está fuera del sistema: si una máquina falla cada 20
        horas en promedio, λ = 1/20 = 0.05 por hora. μ es la tasa de cada servidor (1 / tiempo
        promedio de servicio).
      </p>
      <div className="grid grid-cols-2 gap-3">
        <NumberField name="servers" label="Servidores R" integer />
        <NumberField name="population" label="Población K" integer />
      </div>
    </CalculatorForm>
  );
}
