/**
 * Método de las dos fases (Taha, sec. 3.4.2): la fase I minimiza la suma de las variables
 * artificiales para encontrar una base factible; la fase II parte de esa base y optimiza la
 * función objetivo original sin las artificiales.
 */
import type { Calculator } from '../types';
import { solveTwoPhase, type LpErrorCode, type LpInput, type LpValue } from './lp-solve';
import { lpInputSchema } from './simplex';

export const twoPhase: Calculator<LpInput, LpValue, LpErrorCode> = {
  meta: {
    id: 'metodo-dos-fases',
    title: 'Método de las dos fases',
    summary: 'Simplex que primero busca una base factible y luego optimiza.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 3.4.2, Ejemplo 3.4-2 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'arreola-2003' },
    ],
  },
  inputSchema: lpInputSchema,
  // Taha, ejemplo 3.4-2: el mismo modelo del ejemplo 3.4-1.
  example: {
    sense: 'min',
    objective: '4x1 + x2',
    constraints: '3x1 + x2 = 3\n4x1 + 3x2 >= 6\nx1 + 2x2 <= 4',
  },
  solve: solveTwoPhase,
};
