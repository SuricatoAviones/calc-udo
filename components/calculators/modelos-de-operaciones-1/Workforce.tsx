'use client';

import { Formula } from '@/components/calculators/Formula';
import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { NumberField, TextAreaField } from '@/components/calculators/form/fields';
import { workforce } from '@/lib/calculators/modelos-de-operaciones-1/fuerza-de-trabajo';

export default function Workforce() {
  return (
    <CalculatorForm calculator={workforce}>
      <TextAreaField
        name="requirements"
        label={
          <>
            Trabajadores requeridos por periodo <Formula tex="b_i" />
          </>
        }
        rows={2}
        hint="En orden, separados por espacios: 5 7 8 4 6."
      />
      <NumberField
        name="excessCost"
        label={
          <>
            Costo por trabajador de más <Formula tex="c_e" />
          </>
        }
        hint="Por trabajador y por periodo."
      />
      <div className="grid grid-cols-2 gap-3">
        <NumberField
          name="hiringFixedCost"
          label={
            <>
              Costo fijo de contratar <Formula tex="K" />
            </>
          }
        />
        <NumberField
          name="hiringVariableCost"
          label={
            <>
              Por trabajador <Formula tex="c_c" />
            </>
          }
        />
      </div>
      <NumberField
        name="initialWorkforce"
        integer
        label={
          <>
            Trabajadores al inicio <Formula tex="x_0" />
          </>
        }
      />
    </CalculatorForm>
  );
}
