/**
 * Método de la esquina noroeste para la solución inicial del modelo de transporte (Taha, sec. 5.3.1).
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

export const northwestCorner: Calculator<TransportInput, TransportValue, TransportErrorCode> = {
  meta: {
    id: 'esquina-noroeste',
    title: 'Método de la esquina noroeste',
    summary: 'Solución inicial empezando por la esquina superior izquierda.',
    citations: [
      { sourceId: 'taha', locator: 'Sec. 5.3.1, Ejemplo 5.3-2 (9.ª ed. en inglés)' },
      { sourceId: 'hillier-lieberman-2002' },
      { sourceId: 'winston-1994' },
    ],
  },
  inputSchema: transportInputSchema,
  // Taha, ejemplo 5.3-1: SunRay Transport (3 silos, 4 molinos; costo por camión).
  example: sunRay,
  solve: (input) => solveInitial(input, 'esquina-noroeste'),
};
