'use client';

import { CalculatorForm } from '@/components/calculators/form/CalculatorForm';
import { ExpressionField } from '@/components/calculators/form/fields';
import { convolucion } from '@/lib/calculators/circuitos-y-sistemas/convolucion';
import { signalTex } from '@/lib/calculators/circuitos-y-sistemas/signal';
import { SIGNAL_HINT } from './signal-hint';

export default function Convolucion() {
  return (
    <CalculatorForm calculator={convolucion}>
      <ExpressionField
        name="input"
        label="Entrada x(t)"
        hint={SIGNAL_HINT}
        previewPrefix="x(t) ="
        toTex={signalTex}
      />
      <ExpressionField
        name="impulse"
        label="Respuesta al impulso h(t)"
        hint="Ambas funciones valen 0 para t < 0 (sistema causal)."
        previewPrefix="h(t) ="
        toTex={signalTex}
      />
    </CalculatorForm>
  );
}
