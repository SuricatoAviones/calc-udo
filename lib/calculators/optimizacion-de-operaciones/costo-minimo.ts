/**
 * Método del costo mínimo para la solución inicial del modelo de transporte (Taha, sec. 5.3.1).
 */
import type { Calculator } from '../types';
import {
  solveInitial,
  sunRay,
  transportInputSchema,
  type TransportErrorCode,
  type TransportInput,
  type TransportValue,
} from './transport-initial';

export const leastCost: Calculator<TransportInput, TransportValue, TransportErrorCode> = {
  meta: {
    id: 'costo-minimo',
    title: 'Método del costo mínimo',
    summary: 'Solución inicial asignando primero las celdas más baratas.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 5.3.1, Ejemplo 5.3-3 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'winston-1994' },
    ],
  },
  inputSchema: transportInputSchema,
  // Taha, ejemplo 5.3-1: SunRay Transport (3 silos, 4 molinos; costo por camión).
  example: sunRay,
  solve: (input) => solveInitial(input, 'costo-minimo'),
};
