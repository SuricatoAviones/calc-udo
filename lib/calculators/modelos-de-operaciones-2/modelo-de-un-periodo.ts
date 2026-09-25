/**
 * Modelo de un periodo para productos perecederos, o del vendedor de periódicos (Hillier &
 * Lieberman, sec. 19.6 de la 7.ª ed.; Taha, cap. de inventarios probabilísticos): se pide una
 * sola vez antes de conocer la demanda D.
 *
 *   C_u = p − c + π   (costo de pedir de menos: la ganancia perdida más la penalización)
 *   C_o = c − s + h   (costo de pedir de más: lo que se pierde con cada unidad sobrante)
 *   F(y*) = C_u / (C_u + C_o)                          (razón crítica o nivel de servicio óptimo)
 *
 * Con demanda normal y* = μ + σΦ⁻¹(RC); uniforme en [a, b], y* = a + RC(b − a); exponencial con
 * media λ, y* = −λ ln(1 − RC). Si ya hay x unidades, se pide y* − x (o nada si x ≥ y*).
 */
import { z } from 'zod';
import { formatNumber, toLatexNumber, toLatexOperand } from '@/lib/math/format';
import { normalDensity, standardNormalQuantile } from '@/lib/math/normal';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type Series,
  type Step,
} from '../types';

export const demandDistributions = ['normal', 'uniforme', 'exponencial'] as const;
export type DemandDistribution = (typeof demandDistributions)[number];

const money = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine(Number.isFinite, `${label} debe ser un número finito.`);

const optionalNumber = z
  .number({ error: 'Escribe un número.' })
  .refine(Number.isFinite, 'Debe ser un número finito.')
  .optional();

export const singlePeriodInputSchema = z
  .object({
    price: money('el precio de venta p'),
    cost: money('el costo unitario c'),
    salvage: money('el valor de rescate s'),
    holdingCost: money('el costo de guardar un sobrante h').refine(
      (v) => v >= 0,
      'h no puede ser negativo.',
    ),
    shortageCost: money('la penalización por faltante π').refine(
      (v) => v >= 0,
      'π no puede ser negativa.',
    ),
    distribution: z.enum(demandDistributions, { error: 'Elige la distribución de la demanda.' }),
    mean: optionalNumber,
    sd: optionalNumber,
    min: optionalNumber,
    max: optionalNumber,
    initialStock: z
      .number({ error: 'Escribe un número o deja el campo vacío.' })
      .refine((v) => Number.isFinite(v) && v >= 0, 'El inventario inicial no puede ser negativo.')
      .optional(),
  })
  .superRefine((v, ctx) => {
    const issue = (path: string, message: string) =>
      ctx.addIssue({ code: 'custom', path: [path], message });
    if (v.distribution === 'normal') {
      if (v.mean === undefined) issue('mean', 'Ingresa la demanda media μ.');
      if (v.sd === undefined) issue('sd', 'Ingresa la desviación estándar σ.');
      else if (v.sd <= 0) issue('sd', 'σ debe ser mayor que 0.');
    } else if (v.distribution === 'uniforme') {
      if (v.min === undefined) issue('min', 'Ingresa la demanda mínima a.');
      if (v.max === undefined) issue('max', 'Ingresa la demanda máxima b.');
      else if (v.min !== undefined && v.max <= v.min) issue('max', 'b debe ser mayor que a.');
    } else if (v.mean === undefined) {
      issue('mean', 'Ingresa la demanda media λ.');
    } else if (v.mean <= 0) {
      issue('mean', 'La demanda media debe ser mayor que 0.');
    }
  });

export type SinglePeriodInput = z.infer<typeof singlePeriodInputSchema>;

export interface SinglePeriodValue {
  underage: number;
  overage: number;
  criticalRatio: number;
  /** Nivel de inventario óptimo después de pedir. */
  optimalLevel: number;
  /** Cantidad a pedir considerando el inventario inicial. */
  orderQuantity: number;
}

export type SinglePeriodErrorCode = 'invalid-costs' | 'missing-data';

const n = toLatexNumber;

export function solveSinglePeriod(
  input: SinglePeriodInput,
): CalculatorResult<SinglePeriodValue, SinglePeriodErrorCode> {
  const { price: p, cost: c, salvage: s, holdingCost: h, shortageCost: penalty } = input;
  const underage = p - c + penalty;
  const overage = c - s + h;
  const steps: Step[] = [
    {
      title: 'Costos de pedir de menos y de pedir de más',
      explanation:
        'Si falta una unidad se pierde su ganancia (más la penalización por faltante, si la hay); si sobra, se pierde su costo menos lo que se recupera al rescatarla, más lo que cuesta guardarla.',
      formula: 'C_u = p - c + \\pi, \\qquad C_o = c - s + h',
      substitution: `C_u = ${n(p)} - ${toLatexOperand(c)} + ${toLatexOperand(penalty)}, \\qquad C_o = ${n(c)} - ${toLatexOperand(s)} + ${toLatexOperand(h)}`,
      result: `C_u = ${n(underage)}, \\qquad C_o = ${n(overage)}`,
    },
  ];
  if (underage <= 0 || overage <= 0) {
    return {
      ok: false,
      error: {
        code: 'invalid-costs',
        message:
          underage <= 0
            ? 'C_u ≤ 0: vender no deja ganancia, así que no conviene pedir nada. Revisa el precio y el costo.'
            : 'C_o ≤ 0: una unidad sobrante no genera pérdida, así que convendría pedir sin límite. Revisa el costo, el rescate y el costo de guardar.',
      },
      ...emptyTrace(),
      steps,
    };
  }

  const ratio = underage / (underage + overage);
  steps.push({
    title: 'Razón crítica',
    explanation:
      'Conviene agregar una unidad más mientras la probabilidad de venderla, multiplicada por C_u, supere la de que sobre, multiplicada por C_o. El óptimo deja una probabilidad RC de que la demanda no supere lo pedido.',
    formula: 'F(y^*) = P(D \\le y^*) = \\frac{C_u}{C_u + C_o}',
    substitution: `F(y^*) = \\frac{${n(underage)}}{${n(underage)} + ${n(overage)}}`,
    result: `F(y^*) = ${n(ratio, 6)}`,
  });

  let optimal: number;
  let density: (x: number) => number;
  let from: number;
  let to: number;
  const { mean, sd, min, max } = input;
  if (input.distribution === 'normal') {
    if (mean === undefined || sd === undefined) return missing(steps);
    const z = standardNormalQuantile(ratio);
    optimal = mean + z * sd;
    density = (x) => normalDensity(x, mean, sd);
    [from, to] = [mean - 4 * sd, mean + 4 * sd];
    steps.push({
      title: 'Cantidad óptima (demanda normal)',
      explanation: 'Se busca en la tabla de la normal el valor z con área RC a su izquierda.',
      formula: 'y^* = \\mu + z\\,\\sigma, \\qquad \\Phi(z) = F(y^*)',
      substitution: `\\Phi(z) = ${n(ratio, 6)} \\ \\Rightarrow\\ z = ${n(z, 4)}, \\qquad y^* = ${n(mean)} + ${toLatexOperand(z, 6)}(${n(sd)})`,
      result: `y^* = ${n(optimal, 6)}`,
    });
  } else if (input.distribution === 'uniforme') {
    if (min === undefined || max === undefined) return missing(steps);
    optimal = min + ratio * (max - min);
    density = (x) => (x >= min && x <= max ? 1 / (max - min) : 0);
    const margin = 0.15 * (max - min);
    [from, to] = [min - margin, max + margin];
    steps.push({
      title: 'Cantidad óptima (demanda uniforme)',
      formula: 'F(y) = \\frac{y - a}{b - a} \\ \\Rightarrow\\ y^* = a + F(y^*)\\,(b - a)',
      substitution: `y^* = ${n(min)} + ${n(ratio, 6)}(${n(max)} - ${toLatexOperand(min)})`,
      result: `y^* = ${n(optimal, 6)}`,
    });
  } else {
    if (mean === undefined) return missing(steps);
    optimal = -mean * Math.log(1 - ratio);
    density = (x) => (x < 0 ? 0 : Math.exp(-x / mean) / mean);
    [from, to] = [0, Math.max(5 * mean, optimal * 1.3)];
    steps.push({
      title: 'Cantidad óptima (demanda exponencial)',
      formula:
        'F(y) = 1 - e^{-y/\\lambda} \\ \\Rightarrow\\ y^* = -\\lambda \\ln\\left(1 - F(y^*)\\right)',
      substitution: `y^* = -${n(mean)} \\ln(1 - ${n(ratio, 6)}) = -${n(mean)} \\ln(${n(1 - ratio, 6)})`,
      result: `y^* = ${n(optimal, 6)}`,
    });
  }

  const stock = input.initialStock ?? 0;
  const order = Math.max(0, optimal - stock);
  if (input.initialStock !== undefined) {
    steps.push({
      title: 'Cantidad a pedir con inventario inicial',
      explanation:
        stock < optimal
          ? 'Ya hay inventario: se pide solo lo necesario para llegar a y*.'
          : 'El inventario inicial ya alcanza o supera y*: no se pide nada.',
      formula: '\\text{pedido} = \\max\\{0,\\ y^* - x\\}',
      substitution: `\\max\\{0,\\ ${n(optimal, 6)} - ${n(stock)}\\}`,
      result: `\\text{pedido} = ${n(order, 6)}`,
    });
  }

  const series: Series[] = [
    {
      id: 'demanda',
      title: `Densidad de la demanda y área F(y*) = ${formatNumber(ratio, 4)}`,
      xLabel: 'Demanda',
      yLabel: 'densidad',
      points: Array.from({ length: 161 }, (_, k) => {
        const x = from + ((to - from) * k) / 160;
        return { x, y: density(x) };
      }),
      highlight: { from, to: Math.min(optimal, to) },
    },
  ];

  return {
    ok: true,
    value: {
      underage,
      overage,
      criticalRatio: ratio,
      optimalLevel: optimal,
      orderQuantity: order,
    },
    summary: [
      {
        label:
          input.initialStock === undefined
            ? 'Cantidad óptima a pedir'
            : 'Nivel óptimo de inventario',
        value: `y^* = ${n(optimal, 6)}`,
        emphasis: true,
      },
      ...(input.initialStock === undefined
        ? []
        : [{ label: 'Cantidad a pedir', value: `y^* - x = ${n(order, 6)}` }]),
      { label: 'Razón crítica', value: `F(y^*) = ${n(ratio, 6)}` },
      { label: 'Costos unitarios', value: `C_u = ${n(underage)}, \\quad C_o = ${n(overage)}` },
    ],
    ...emptyTrace(),
    steps,
    notices: [
      {
        level: 'info',
        message: `Con una demanda discreta se pide el menor entero y con P(D ≤ y) ≥ ${formatNumber(ratio, 4)}; con una continua, y* suele redondearse al entero más cercano (${Math.round(optimal)}).`,
      },
    ],
    series,
  };
}

function missing(steps: Step[]): CalculatorResult<SinglePeriodValue, SinglePeriodErrorCode> {
  return {
    ok: false,
    error: {
      code: 'missing-data',
      message: 'Faltan los parámetros de la distribución de la demanda.',
    },
    ...emptyTrace(),
    steps,
  };
}

export const singlePeriod: Calculator<SinglePeriodInput, SinglePeriodValue, SinglePeriodErrorCode> =
  {
    meta: {
      id: 'modelo-de-un-periodo',
      title: 'Modelo de un periodo (vendedor de periódicos)',
      summary: 'Cuánto pedir de un producto perecedero con demanda aleatoria.',
      citations: [
        {
          sourceId: 'hillier-lieberman-2002',
          locator:
            'Sec. 19.6, modelo de un periodo para productos perecederos: ejemplo de las bicicletas (7.ª ed. en inglés)',
        },
        { sourceId: 'taha' },
        { sourceId: 'diaz-matalobos-1998' },
      ],
    },
    inputSchema: singlePeriodInputSchema,
    // Hillier & Lieberman: bicicletas a $20 que se venden a $45; las que sobran se rescatan a $10
    // con $1 de costo de guardarlas; la demanda es exponencial con media 10,000.
    example: {
      price: 45,
      cost: 20,
      salvage: 10,
      holdingCost: 1,
      shortageCost: 0,
      distribution: 'exponencial',
      mean: 10000,
    },
    solve: solveSinglePeriod,
  };
