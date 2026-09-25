'use client';

import { useFormContext, useWatch } from 'react-hook-form';
import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, SelectField } from '@/components/calculators/form/fields';
import { singlePeriod } from '@/lib/calculators/modelos-de-operaciones-2/modelo-de-un-periodo';

function DistributionFields() {
  const { control } = useFormContext();
  const distribution = useWatch({ control, name: 'distribution' }) as string;
  return (
    <>
      <SelectField
        name="distribution"
        label="Distribución de la demanda"
        options={[
          { value: 'normal', label: 'Normal' },
          { value: 'uniforme', label: 'Uniforme' },
          { value: 'exponencial', label: 'Exponencial' },
        ]}
      />
      {distribution === 'normal' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            name="mean"
            optional
            label={
              <>
                Media <Formula tex="\mu" />
              </>
            }
          />
          <NumberField
            name="sd"
            optional
            label={
              <>
                Desviación <Formula tex="\sigma" />
              </>
            }
          />
        </div>
      )}
      {distribution === 'uniforme' && (
        <div className="grid grid-cols-2 gap-3">
          <NumberField
            name="min"
            optional
            label={
              <>
                Mínimo <Formula tex="a" />
              </>
            }
          />
          <NumberField
            name="max"
            optional
            label={
              <>
                Máximo <Formula tex="b" />
              </>
            }
          />
        </div>
      )}
      {distribution === 'exponencial' && (
        <NumberField
          name="mean"
          optional
          label={
            <>
              Demanda media <Formula tex="\lambda" />
            </>
          }
        />
      )}
    </>
  );
}

export default function SinglePeriod() {
  return (
    <CalculatorForm calculator={singlePeriod}>
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="price"
          label={
            <>
              Precio de venta <Formula tex="p" />
            </>
          }
        />
        <NumberField
          name="cost"
          label={
            <>
              Costo unitario <Formula tex="c" />
            </>
          }
        />
        <NumberField
          name="salvage"
          label={
            <>
              Valor de rescate <Formula tex="s" />
            </>
          }
          hint="Lo que se recupera por unidad sobrante."
        />
        <NumberField
          name="holdingCost"
          label={
            <>
              Costo de guardar <Formula tex="h" />
            </>
          }
          hint="Por unidad sobrante (0 si no aplica)."
        />
      </div>
      <NumberField
        name="shortageCost"
        label={
          <>
            Penalización por faltante <Formula tex="\pi" />
          </>
        }
        hint="Costo adicional por unidad de demanda no atendida (0 si solo se pierde la venta)."
      />
      <DistributionFields />
      <NumberField
        name="initialStock"
        optional
        label={
          <>
            Inventario inicial <Formula tex="x" />
          </>
        }
        hint="Opcional."
      />
    </CalculatorForm>
  );
}
