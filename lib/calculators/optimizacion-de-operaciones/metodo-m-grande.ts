/**
 * Método de la M grande (Taha, sec. 3.4.1): las restricciones ≥ y = reciben variables
 * artificiales que se penalizan en la función objetivo con un coeficiente M muy grande (−M al
 * maximizar, +M al minimizar). Aquí M es simbólica: los coeficientes de la fila z son a + bM.
 */
import type { Calculator } from '../types';
import { solveBigM, type LpErrorCode, type LpInput, type LpValue } from './lp-solve';
import { lpInputSchema } from './simplex';

export const bigM: Calculator<LpInput, LpValue, LpErrorCode> = {
  meta: {
    id: 'metodo-m-grande',
    title: 'Método de la M grande',
    summary: 'Simplex con variables artificiales penalizadas con una M simbólica.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 3.4.1, Ejemplo 3.4-1 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'arreola-2003' },
    ],
  },
  inputSchema: lpInputSchema,
  // Taha, ejemplo 3.4-1.
  example: {
    sense: 'min',
    objective: '4x1 + x2',
    constraints: '3x1 + x2 = 3\n4x1 + 3x2 >= 6\nx1 + 2x2 <= 4',
  },
  solve: solveBigM,
};
