/**
 * Método simplex tabular (Taha, sec. 3.3): modelos con restricciones ≤ y lado derecho no
 * negativo, cuya base inicial son las holguras. Los modelos con restricciones ≥ o = necesitan
 * variables artificiales (M grande o dos fases).
 */
import { z } from 'zod';
import type { Calculator } from '../types';
import { lpInputShape, refineLp } from './lp-model';
import { solveSimplexTabular, type LpErrorCode, type LpInput, type LpValue } from './lp-solve';

export const lpInputSchema = z.object(lpInputShape).superRefine(refineLp);

export const simplexTabular: Calculator<LpInput, LpValue, LpErrorCode> = {
  meta: {
    id: 'simplex',
    title: 'Método simplex tabular',
    summary:
      'Resuelve un modelo de programación lineal con tablas simplex, iteración por iteración.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Sec. 3.3, Ejemplo 3.3-1: modelo de Reddy Mikks (9.ª ed. en inglés)',
      },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'arreola-2003' },
    ],
  },
  inputSchema: lpInputSchema,
  // Taha, modelo de Reddy Mikks: pinturas para exteriores (x1) e interiores (x2), en toneladas.
  example: {
    sense: 'max',
    objective: '5x1 + 4x2',
    constraints: '6x1 + 4x2 <= 24\nx1 + 2x2 <= 6\n-x1 + x2 <= 1\nx2 <= 2',
  },
  solve: solveSimplexTabular,
};
