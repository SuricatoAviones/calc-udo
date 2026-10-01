'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { SelectField, TextField } from '@/components/calculators/form/fields';
import { forecastSelection } from '@/lib/calculators/modelos-de-operaciones-2/seleccion-de-metodo-de-pronostico';
import { SeriesDataField } from './SeriesDataField';

export default function ForecastSelection() {
  return (
    <CalculatorForm calculator={forecastSelection}>
      <SeriesDataField />
      <p className="text-muted-foreground -mt-2 text-xs">
        Siempre se comparan el método ingenuo y el promedio de todos los datos anteriores; agrega
        los demás métodos que quieras evaluar.
      </p>
      <div className="grid grid-cols-2 gap-3">
        <TextField name="orders" label="Promedios móviles: k" placeholder="3, 6" />
        <TextField name="alphas" label="Suavizamiento: α" placeholder="0.2, 0.3" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <SelectField
          name="trend"
          label="Tendencia lineal"
          options={[
            { value: 'no', label: 'No incluir' },
            { value: 'si', label: 'Incluir' },
          ]}
        />
        <SelectField
          name="criterion"
          label="Elegir por"
          options={[
            { value: 'mse', label: 'MSE' },
            { value: 'mad', label: 'MAD' },
            { value: 'mape', label: 'MAPE' },
          ]}
        />
      </div>
    </CalculatorForm>
  );
}
