/**
 * Método de bisección (método cerrado): x_r = (x_l + x_u) / 2.
 * Chapra & Canale, sec. 5.2 (algoritmo de la figura 5.10). El resto del procedimiento es común
 * a los métodos cerrados (ver bracketing.ts).
 */
import { toLatexNumber, toLatexOperand } from '@/lib/math/format';
import type { Calculator } from '../types';
import {
  bracketingInputSchema,
  solveBracketing,
  type BracketingErrorCode,
  type BracketingInput,
  type BracketingRule,
  type BracketingValue,
} from './bracketing';

export type BisectionInput = BracketingInput;

const rule: BracketingRule = {
  methodName: 'La bisección',
  pointTitle: 'Punto medio del intervalo',
  formula: 'x_r = \\frac{x_l + x_u}{2}',
  compute: (xl, xu) => (xl + xu) / 2,
  substitution: (xl, xu) => `x_r = \\frac{${toLatexNumber(xl)} + ${toLatexOperand(xu)}}{2}`,
};

export const bisection: Calculator<BracketingInput, BracketingValue, BracketingErrorCode> = {
  meta: {
    id: 'biseccion',
    title: 'Método de bisección',
    summary: 'Aproxima una raíz dividiendo a la mitad un intervalo con cambio de signo.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator: 'Cap. 5, sección 5.2, Ejemplos 5.3 y 5.4 (pp. 125–127 de la 5.ª ed. en español)',
      },
      { sourceId: 'nakamura-1994' },
      { sourceId: 'ledanois-2000' },
    ],
  },
  inputSchema: bracketingInputSchema,
  // Chapra & Canale, ejemplos 5.3 y 5.4: paracaidista, [12, 16], εs = 0.5 %.
  example: {
    expression: '667.38/x * (1 - e^(-0.146843 x)) - 40',
    xl: 12,
    xu: 16,
    tolerance: 0.5,
    maxIterations: 50,
  },
  solve: (input) => solveBracketing(input, rule),
};
