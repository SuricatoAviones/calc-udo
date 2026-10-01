/**
 * Modelo de periodo fijo con inventario de seguridad (Chase, Jacobs y Aquilano, cap. 17 de la
 * 12.ª ed. en español; Anderson, Sweeney y Williams, sec. 10.7): el inventario
 * se revisa cada T periodos y se pide lo necesario para cubrir la demanda del periodo vulnerable
 * T + L con una probabilidad P de no agotarse.
 *
 *   σ_{T+L} = √(T + L)·σ_d,   z = Φ⁻¹(P),   inventario de seguridad = z·σ_{T+L}
 *   q = d̄(T + L) + z·σ_{T+L} − I
 *
 * donde d̄ y σ_d son la media y la desviación estándar de la demanda por periodo (independiente
 * entre periodos) e I el inventario actual más lo ya pedido.
 */
import { z } from 'zod';
import { standardNormalQuantile } from '@/lib/math/normal';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';
import { nonNegativeField, positiveField } from './inventory';

export const periodicReviewInputSchema = z.object({
  demand: positiveField('la demanda promedio por periodo d̄'),
  sigma: nonNegativeField('la desviación estándar de la demanda σ_d'),
  review: positiveField('el periodo de revisión T'),
  leadTime: nonNegativeField('el tiempo de entrega L'),
  serviceLevel: z
    .number({ error: 'Ingresa la probabilidad de servicio P.' })
    .refine((v) => v > 0.5 && v < 1, 'La probabilidad de servicio debe estar entre 0.5 y 1.'),
  onHand: nonNegativeField('el inventario actual I'),
});

export type PeriodicReviewInput = z.infer<typeof periodicReviewInputSchema>;

export interface PeriodicReviewValue {
  sigmaTL: number;
  z: number;
  safetyStock: number;
  /** Nivel meta: d̄(T + L) + inventario de seguridad. */
  targetLevel: number;
  orderQuantity: number;
  /** Cantidad a pedir redondeada hacia arriba (unidades completas). */
  roundedQuantity: number;
  averageInventory: number;
}

export type PeriodicReviewErrorCode = never;

type Result = CalculatorResult<PeriodicReviewValue, PeriodicReviewErrorCode>;

const n = toLatexNumber;

export function solvePeriodicReview(input: PeriodicReviewInput): Result {
  const { demand: d, sigma, review: T, leadTime: L, serviceLevel: P, onHand: I } = input;
  const exposure = T + L;
  const sigmaTL = Math.sqrt(exposure) * sigma;
  const z = standardNormalQuantile(P);
  const safetyStock = z * sigmaTL;
  const expected = d * exposure;
  const targetLevel = expected + safetyStock;
  const orderQuantity = targetLevel - I;
  const roundedQuantity = Math.max(0, Math.ceil(orderQuantity - 1e-9));
  const averageInventory = (d * T) / 2 + safetyStock;

  const steps: Step[] = [
    {
      title: 'Desviación estándar en el periodo vulnerable',
      explanation:
        'El pedido debe cubrir la revisión T y el tiempo de entrega L. Si la demanda de cada periodo es independiente, las varianzas se suman.',
      formula: '\\sigma_{T+L} = \\sqrt{(T + L)\\,\\sigma_d^2}',
      substitution: `\\sigma_{T+L} = \\sqrt{(${n(T)} + ${n(L)})(${n(sigma)})^2}`,
      result: `\\sigma_{T+L} = ${n(sigmaTL)}`,
    },
    {
      title: 'Valor de z para la probabilidad de servicio',
      explanation: `Es el número de desviaciones estándar que deja una probabilidad ${formatNumber(P)} a la izquierda en la normal estándar (en las tablas se lee con 2 decimales).`,
      formula: 'z = \\Phi^{-1}(P)',
      substitution: `z = \\Phi^{-1}(${n(P)})`,
      result: `z = ${n(z, 6)}`,
    },
    {
      title: 'Inventario de seguridad',
      formula: '\\text{IS} = z\\,\\sigma_{T+L}',
      substitution: `\\text{IS} = (${n(z, 6)})(${n(sigmaTL, 6)})`,
      result: `\\text{IS} = ${n(safetyStock)}`,
    },
    {
      title: 'Cantidad a pedir',
      explanation:
        'Demanda promedio del periodo vulnerable más el inventario de seguridad, menos lo que ya se tiene (incluido lo pedido).',
      formula: 'q = \\bar d\\,(T + L) + z\\,\\sigma_{T+L} - I',
      substitution: `q = ${n(d)}(${n(T)} + ${n(L)}) + ${n(safetyStock, 6)} - ${n(I)}`,
      result: `q = ${n(orderQuantity)} \\ \\Rightarrow\\ ${roundedQuantity} \\text{ unidades}`,
    },
    {
      title: 'Inventario promedio',
      explanation:
        'En promedio se tiene la mitad de lo que se consume en un ciclo de revisión más el inventario de seguridad.',
      formula: '\\bar I = \\frac{\\bar d\\,T}{2} + \\text{IS}',
      substitution: `\\bar I = \\frac{${n(d)}(${n(T)})}{2} + ${n(safetyStock, 6)}`,
      result: `\\bar I = ${n(averageInventory)}`,
    },
  ];

  return {
    ok: true,
    value: {
      sigmaTL,
      z,
      safetyStock,
      targetLevel,
      orderQuantity,
      roundedQuantity,
      averageInventory,
    },
    summary: [
      {
        label: 'Cantidad a pedir',
        value: `q = ${n(orderQuantity, 6)} \\approx ${roundedQuantity}`,
        emphasis: true,
      },
      { label: 'Inventario de seguridad', value: `\\text{IS} = ${n(safetyStock, 6)}` },
      { label: 'Nivel meta', value: `\\bar d(T + L) + \\text{IS} = ${n(targetLevel, 6)}` },
      { label: 'Inventario promedio', value: `\\bar I = ${n(averageInventory, 6)}` },
    ],
    ...emptyTrace(),
    steps,
    notices:
      orderQuantity < 0
        ? [
            {
              level: 'info',
              message:
                'El inventario actual ya supera el nivel meta: en esta revisión no hace falta pedir.',
            },
          ]
        : [],
  };
}

export const periodicReview: Calculator<
  PeriodicReviewInput,
  PeriodicReviewValue,
  PeriodicReviewErrorCode
> = {
  meta: {
    id: 'revision-periodica',
    title: 'Modelo de periodo fijo (revisión periódica)',
    summary: 'Cantidad a pedir en cada revisión con inventario de seguridad.',
    citations: [
      {
        sourceId: 'aquilano-1994',
        locator:
          'Chase, Jacobs y Aquilano, cap. 17, Ejemplo 17.5 (12.ª ed. en español; Ejemplo 20.5 de la 15.ª)',
      },
      { sourceId: 'anderson-1993', locator: 'Sec. 10.7 (13.ª ed.)' },
      { sourceId: 'diaz-matalobos-1998' },
    ],
  },
  inputSchema: periodicReviewInputSchema,
  // Chase, Jacobs y Aquilano, ejemplo 20.5: demanda diaria de 10 unidades (σ = 3), revisión cada
  // 30 días, entrega en 14, servicio del 98 % y 150 unidades en inventario.
  example: { demand: 10, sigma: 3, review: 30, leadTime: 14, serviceLevel: 0.98, onHand: 150 },
  solve: solvePeriodicReview,
};
