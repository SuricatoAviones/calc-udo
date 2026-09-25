'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { reorder } from '@/lib/calculators/modelos-de-operaciones-2/punto-de-reorden';

function DemandFields() {
  const { control } = useFormContext();
  const perPeriod = useWatch({ control, name: 'mode' }) === 'por-periodo';
  if (!perPeriod) {
    return (
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="leadDemandMean"
          optional
          label={
            <>
              Media <Formula tex="\mu_L" />
            </>
          }
        />
        <NumberField
          name="leadDemandSd"
          optional
          label={
            <>
              Desviación <Formula tex="\sigma_L" />
            </>
          }
        />
      </div>
    );
  }
  return (
    <>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="demandMean"
          optional
          label={
            <>
              Media <Formula tex="d" />
            </>
          }
          hint="Por periodo."
        />
        <NumberField
          name="demandSd"
          optional
          label={
            <>
              Desviación <Formula tex="\sigma_d" />
            </>
          }
          hint="Por periodo."
        />
      </div>
      <NumberField
        name="leadTime"
        optional
        label={
          <>
            Tiempo de entrega <Formula tex="L" />
          </>
        }
        hint="En periodos."
      />
    </>
  );
}

export default function Reorder() {
  return (
    <CalculatorForm calculator={reorder}>
      <SelectField
        name="mode"
        label="Demanda conocida"
        options={[
          { value: 'por-periodo', label: 'Por periodo (d, σ_d y L)' },
          { value: 'tiempo-de-entrega', label: 'En el tiempo de entrega (μ_L, σ_L)' },
        ]}
      />
      <DemandFields />
      <NumberField
        name="serviceLevel"
        label="Nivel de servicio"
        hint="Probabilidad de no quedarse sin inventario mientras llega el pedido: 0.95 = 95 %."
      />
    </CalculatorForm>
  );
}
