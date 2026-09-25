/**
 * Método de la falsa posición (regula falsi): x_r es la intersección con el eje x de la recta que
 * une (x_l, f(x_l)) y (x_u, f(x_u)).
 *
 *   x_r = x_u − f(x_u)(x_l − x_u) / (f(x_l) − f(x_u))        (Chapra & Canale, ec. 5.7)
 *
 * El resto del procedimiento es común a los métodos cerrados (ver bracketing.ts).
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

export type FalsePositionInput = BracketingInput;

const n = toLatexNumber;
const op = toLatexOperand;

const rule: BracketingRule = {
  methodName: 'La falsa posición',
  pointTitle: 'Intersección de la recta con el eje x',
  pointExplanation:
    'Se une (xₗ, f(xₗ)) con (xᵤ, f(xᵤ)) mediante una recta; donde esa recta corta el eje x está la nueva aproximación.',
  formula: 'x_r = x_u - \\frac{f(x_u)\\,(x_l - x_u)}{f(x_l) - f(x_u)}',
  compute: (xl, xu, fxl, fxu) => xu - (fxu * (xl - xu)) / (fxl - fxu),
  substitution: (xl, xu, fxl, fxu) =>
    `x_r = ${n(xu)} - \\frac{${op(fxu)}\\,(${n(xl)} - ${op(xu)})}{${n(fxl)} - ${op(fxu)}}`,
};

export const falsePosition: Calculator<BracketingInput, BracketingValue, BracketingErrorCode> = {
  meta: {
    id: 'falsa-posicion',
    title: 'Método de la falsa posición',
    summary: 'Aproxima una raíz por interpolación lineal dentro de un intervalo.',
    citations: [
      {
        sourceId: 'chapra-canale-2000',
        locator: 'Cap. 5, sección 5.3, Ejemplo 5.5 (p. 134 de la 5.ª ed. en español)',
      },
      {
        sourceId: 'chapra-canale-2000',
        locator: 'Cap. 6, Ejemplo 6.7: comparación con la secante (p. 156)',
      },
      { sourceId: 'nakamura-1994' },
    ],
  },
  inputSchema: bracketingInputSchema,
  // Chapra & Canale, ejemplo 5.5: el mismo paracaidista de la bisección, [12, 16].
  example: {
    expression: '667.38/x * (1 - e^(-0.146843 x)) - 40',
    xl: 12,
    xu: 16,
    tolerance: 0.5,
    maxIterations: 50,
  },
  solve: (input) => solveBracketing(input, rule),
};
