/**
 * Lugar geométrico de las raíces (LGR) de un sistema con función de transferencia en lazo
 * abierto K·G(s)H(s): reglas de construcción, gráfica, ganancia y frecuencia críticas, ganancia
 * para un factor de amortiguamiento dado y polos en lazo cerrado para una ganancia dada.
 *
 * Fuentes: Ogata, 3.ª ed., sec. 6-2 (ejemplos 6-1 y 6-2) y 6-3 (reglas generales); Kuo, 7.ª ed.,
 * cap. 8.
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type {
  Calculator,
  CalculatorResult,
  Notice,
  Point,
  ResultTable,
  Series,
  Step,
  SummaryItem,
} from '../types';
import { polyTex as laplacePolyTex } from '../circuitos-y-sistemas/laplace';
import {
  asymptotes,
  axisCrossings,
  breakPoints,
  closedLoopRoots,
  dampingPoints,
  departureAngles,
  locusBranches,
  locusData,
  realAxisSegments,
  splitJw,
} from './root-locus';
import { parseTf, rootsText, tfTex } from './transfer-function';
import { polyRoots } from '@/lib/math/polynomials';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
const deg = (v: number) => `${n(v)}^{\\circ}`;
const rect = (z: Complex) => C.toLatexRect(z, DIGITS);

const inputSchema = z.object({
  openLoop: z
    .string()
    .trim()
    .min(1, 'Escribe G(s)H(s).')
    .max(200, 'La expresión es demasiado larga.'),
  /** Factor de amortiguamiento para buscar la ganancia (opcional). */
  zeta: z
    .number()
    .min(0, 'ζ debe estar entre 0 y 1.')
    .max(1, 'ζ debe estar entre 0 y 1.')
    .optional(),
  /** Ganancia para calcular los polos en lazo cerrado (opcional). */
  gain: z.number().min(0, 'K debe ser positiva.').optional(),
});

export type RootLocusInput = z.infer<typeof inputSchema>;

export interface RootLocusValue {
  poles: Complex[];
  zeros: Complex[];
  asymptotes: { count: number; angles: number[]; centroid: number } | null;
  realAxis: [number, number][];
  breakaway: { s: Complex; K: number }[];
  departures: { root: Complex; kind: 'polo' | 'cero'; angle: number }[];
  crossings: { omega: number; K: number }[];
  dampingPoints: { s: Complex; K: number }[];
  closedLoop: Complex[] | null;
}

export type RootLocusErrorCode = 'funcion-invalida' | 'sin-polos';

function fail(
  code: RootLocusErrorCode,
  message: string,
): CalculatorResult<RootLocusValue, RootLocusErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps: [],
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

/** D_r(ω) + K·N_r(ω) (o la parte imaginaria), sin los términos nulos. */
function partTex(d: number[], nn: number[]): string {
  const dTex = d.every((c) => c === 0) ? '' : laplacePolyTex(d, '\\omega');
  const nZero = nn.every((c) => c === 0);
  const nIsOne = nn.length === 1 && nn[0] === 1;
  const kTex = nZero ? '' : nIsOne ? 'K' : `K\\left(${laplacePolyTex(nn, '\\omega')}\\right)`;
  if (!dTex) return kTex || '0';
  return kTex ? `${dTex} + ${kTex}` : dTex;
}

const intervalTex = ([a, b]: [number, number]) =>
  `${Number.isFinite(a) ? n(a) : '-\\infty'} < \\sigma < ${Number.isFinite(b) ? n(b) : '\\infty'}`;

export function solveRootLocus(
  input: RootLocusInput,
): CalculatorResult<RootLocusValue, RootLocusErrorCode> {
  // K se puede escribir o no: el lugar es para K·G(s)H(s) con K ≥ 0.
  const source = input.openLoop.replace(/\bK\b/g, '1');
  const parsed = parseTf(source, 'G(s)H(s)');
  if (!parsed.ok) return fail('funcion-invalida', parsed.message);
  const data = locusData(parsed.tf.num, parsed.tf.den);
  if (data.n === 0)
    return fail('sin-polos', 'G(s)H(s) no tiene polos: no hay lugar de las raíces.');
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const tables: ResultTable[] = [];
  const F = parsed.tf;

  steps.push({
    title: 'Ecuación característica',
    explanation: `Los polos en lazo cerrado son las raíces de 1 + KG(s)H(s) = 0 para K ≥ 0. Polos de lazo abierto (K = 0, inicio de las ramas): ${rootsText(polyRoots(F.den))}. Ceros de lazo abierto (fin de las ramas): ${data.m ? rootsText(polyRoots(F.num)) : 'ninguno'}. Hay ${data.n} ramas${data.n > data.m ? `; ${data.n - data.m} van al infinito` : ''}.`,
    formula: '1 + KG(s)H(s) = 0 \\iff D(s) + K\\,N(s) = 0',
    result: `G(s)H(s) = ${tfTex(F)},\\quad ${laplacePolyTex(F.den)} + K\\left(${laplacePolyTex(F.num)}\\right) = 0`,
  });
  steps.push({
    title: 'Condiciones de ángulo y de magnitud',
    explanation:
      'Un punto s está en el lugar si el ángulo de G(s)H(s) es un múltiplo impar de 180°; la ganancia en ese punto sale de la condición de magnitud.',
    formula: '\\angle G(s)H(s) = \\pm 180^{\\circ}(2k + 1),\\qquad K = \\frac{1}{|G(s)H(s)|}',
  });

  const segments = realAxisSegments(data);
  steps.push({
    title: 'Lugar sobre el eje real',
    explanation:
      'Un punto del eje real está en el lugar si a su derecha hay un número impar de polos y ceros reales (los complejos conjugados se cancelan).',
    result: segments.length ? segments.map(intervalTex).join(',\\quad ') : '\\text{ningún tramo}',
  });

  const asym = asymptotes(data);
  if (asym) {
    steps.push({
      title: 'Asíntotas',
      explanation: `n − m = ${asym.count} ramas tienden al infinito siguiendo las asíntotas.`,
      formula: `\\text{Ángulos} = \\frac{\\pm 180^{\\circ}(2k + 1)}{n - m},\\qquad \\sigma_a = \\frac{\\sum \\text{polos} - \\sum \\text{ceros}}{n - m}`,
      substitution: `\\sigma_a = \\frac{(${n(data.poles.reduce((s, p) => s + p.re, 0))}) - (${n(data.zeros.reduce((s, z) => s + z.re, 0))})}{${asym.count}}`,
      result: `\\text{Ángulos: } ${asym.angles.map(deg).join(',\\ ')},\\qquad \\sigma_a = ${n(asym.centroid)}`,
    });
  }

  const breaks = breakPoints(data);
  const breakaway = breaks.points.filter((p) => p.valid).map((p) => ({ s: p.s, K: p.K }));
  if (breaks.polynomial.length >= 2) {
    steps.push({
      title: 'Puntos de ruptura (desprendimiento e ingreso)',
      explanation: `Son raíces múltiples de la ecuación característica: de K = −D(s)/N(s) se pide dK/ds = 0. Solo cuentan las raíces con K real y positiva (están sobre el lugar). ${breaks.points
        .map(
          (p) =>
            `s = ${C.toTextRect(p.s, DIGITS)} da K = ${formatNumber(p.K, DIGITS)}${p.valid ? ' (sí)' : ' (no está en el lugar)'}`,
        )
        .join('; ')}.`,
      formula: "\\frac{dK}{ds} = 0 \\iff N(s)D'(s) - N'(s)D(s) = 0",
      result: `${laplacePolyTex(breaks.polynomial)} = 0`,
    });
  }

  const departures = departureAngles(data);
  if (departures.length) {
    steps.push({
      title: 'Ángulos de salida y de llegada',
      explanation:
        'Para un polo complejo: θ = 180° − Σ(ángulos desde los otros polos) + Σ(ángulos desde los ceros). Para un cero complejo: φ = 180° + Σ(ángulos desde los polos) − Σ(ángulos desde los otros ceros). Los conjugados tienen el ángulo opuesto.',
      children: departures.map((d) => ({
        title: `${d.kind === 'polo' ? 'Salida del polo' : 'Llegada al cero'} ${C.toTextRect(d.root, DIGITS)}`,
        substitution: d.others
          .map(
            (o) => `\\angle(${rect(d.root)} - (${rect(o.from)})) = ${deg(o.angle)}\\ (${o.kind})`,
          )
          .join(',\\ '),
        result: `${d.kind === 'polo' ? '\\theta' : '\\phi'} = ${deg(d.angle)}`,
      })),
    });
  }

  const cross = axisCrossings(data);
  const crossings = cross.crossings.filter((c) => c.omega > 1e-9);
  const dSplit = splitJw(F.den);
  const nSplit = splitJw(F.num);
  steps.push({
    title: 'Cruces con el eje imaginario',
    explanation: crossings.length
      ? 'Se sustituye s = jω en la ecuación característica y se igualan a cero la parte real y la imaginaria (o se usa el arreglo de Routh). La ganancia del cruce es la ganancia crítica: para K mayores el sistema es inestable.'
      : 'Al sustituir s = jω no hay soluciones con K positiva y ω > 0: el lugar no cruza el eje imaginario.',
    formula: 'D(j\\omega) + K\\,N(j\\omega) = 0',
    substitution: `\\left(${partTex(dSplit.re, nSplit.re)}\\right) + j\\left(${partTex(dSplit.im, nSplit.im)}\\right) = 0`,
    result: crossings.length
      ? crossings
          .map((c) => `\\omega = \\pm ${n(c.omega)}\\ \\text{rad/s},\\ K = ${n(c.K)}`)
          .join(';\\quad ')
      : undefined,
  });

  let zetaPoints: { s: Complex; K: number }[] = [];
  if (input.zeta !== undefined) {
    zetaPoints = dampingPoints(data, input.zeta);
    const beta = C.degrees(Math.acos(input.zeta));
    steps.push({
      title: `Ganancia para ζ = ${formatNumber(input.zeta, DIGITS)}`,
      explanation: zetaPoints.length
        ? `Los polos con ese amortiguamiento están sobre la recta que forma ±cos⁻¹ζ = ±${formatNumber(beta, DIGITS)}° con el eje real negativo. Donde la recta corta el lugar se cumple la condición de ángulo; K sale de la condición de magnitud.`
        : 'La recta de ese factor de amortiguamiento no corta el lugar.',
      formula: 'K = \\left|\\frac{D(s)}{N(s)}\\right|',
      result: zetaPoints.length
        ? zetaPoints.map((p) => `s = ${rect(p.s)},\\ K = ${n(p.K)}`).join(';\\quad ')
        : undefined,
      children: zetaPoints.map((p) => {
        const others = closedLoopRoots(data, p.K).filter(
          (r) => C.abs(C.sub(r, p.s)) > 1e-6 && C.abs(C.sub(r, C.conj(p.s))) > 1e-6,
        );
        return {
          title: `Con K = ${formatNumber(p.K, DIGITS)}`,
          explanation: others.length
            ? `Los demás polos en lazo cerrado: ${others.map((r) => C.toTextRect(r, DIGITS)).join(', ')}.`
            : undefined,
        };
      }),
    });
  }

  let closedLoop: Complex[] | null = null;
  if (input.gain !== undefined) {
    closedLoop = closedLoopRoots(data, input.gain);
    const unstable = closedLoop.some((r) => r.re > 1e-9);
    steps.push({
      title: `Polos en lazo cerrado con K = ${formatNumber(input.gain, DIGITS)}`,
      explanation: unstable
        ? 'Hay polos con parte real positiva: el sistema es inestable con esta ganancia.'
        : undefined,
      formula: 'D(s) + K\\,N(s) = 0',
      result: closedLoop
        .filter((r) => r.im >= -1e-12)
        .map((r) => `s = ${rect(r)}`)
        .join(',\\ '),
    });
  }

  // Gráfica.
  const keyPoints: Complex[] = [
    ...data.poles,
    ...data.zeros,
    ...breakaway.map((b) => b.s),
    ...crossings.map((c) => C.complex(0, c.omega)),
    ...zetaPoints.map((p) => p.s),
    ...(asym ? [C.complex(asym.centroid)] : []),
  ];
  const radius =
    1.3 * Math.max(1, ...keyPoints.map((p) => Math.max(Math.abs(p.re), Math.abs(p.im))));
  const branches = locusBranches(data, radius, [
    ...breakaway.map((b) => b.K),
    ...crossings.map((c) => c.K),
  ]);
  const curves: NonNullable<Series['curves']> = branches.map((points, i) => ({
    label: `Rama ${i + 1}`,
    points,
  }));
  if (asym) {
    for (const angle of asym.angles) {
      const end = C.add(C.complex(asym.centroid), C.fromPolar(2 * radius, C.radians(angle)));
      curves.push({
        label: 'Asíntota',
        points: [
          { x: asym.centroid, y: 0 },
          { x: end.re, y: end.im },
        ],
        dashed: true,
      });
    }
  }
  if (input.zeta !== undefined) {
    const theta = Math.PI - Math.acos(input.zeta);
    const end = C.fromPolar(2 * radius, theta);
    curves.push({
      label: `ζ = ${formatNumber(input.zeta, 4)}`,
      points: [
        { x: 0, y: 0 },
        { x: end.re, y: end.im },
      ],
      dashed: true,
    });
  }
  const toPoints = (list: Complex[]): Point[] => list.map((p) => ({ x: p.re, y: p.im }));
  const markers: NonNullable<Series['markers']> = [
    { label: 'Polos de lazo abierto', shape: 'cross', points: toPoints(data.poles) },
  ];
  if (data.zeros.length)
    markers.push({ label: 'Ceros de lazo abierto', shape: 'circle', points: toPoints(data.zeros) });
  const special = [
    ...breakaway.flatMap((b) => [b.s, C.conj(b.s)]),
    ...crossings.flatMap((c) => [C.complex(0, c.omega), C.complex(0, -c.omega)]),
    ...zetaPoints.flatMap((p) => [p.s, C.conj(p.s)]),
    ...(closedLoop ?? []),
  ];
  if (special.length)
    markers.push({ label: 'Puntos calculados', shape: 'dot', points: toPoints(special) });
  const series: Series[] = [
    {
      id: 'lgr',
      title: 'Lugar geométrico de las raíces',
      xLabel: 'Re(s)',
      yLabel: 'Im(s)',
      kind: 'plane',
      points: [],
      curves,
      markers,
    },
  ];

  tables.push({
    id: 'puntos',
    title: 'Puntos notables',
    columns: [
      { key: 'punto', header: '\\text{Punto}', format: 'latex' },
      { key: 's', header: 's', format: 'latex' },
      { key: 'K', header: 'K' },
    ],
    rows: [
      ...breakaway.map((b) => ({ punto: '\\text{Ruptura}', s: rect(b.s), K: b.K })),
      ...crossings.map((c) => ({
        punto: '\\text{Cruce con } j\\omega',
        s: `\\pm j${n(c.omega)}`,
        K: c.K,
      })),
      ...zetaPoints.map((p) => ({ punto: `\\zeta = ${n(input.zeta!)}`, s: rect(p.s), K: p.K })),
    ],
  });

  const summary: SummaryItem[] = [];
  if (asym)
    summary.push({
      label: 'Asíntotas',
      value: `${asym.angles.map(deg).join(',\\ ')},\\ \\sigma_a = ${n(asym.centroid)}`,
    });
  if (breakaway.length)
    summary.push({
      label: 'Ruptura',
      value: breakaway.map((b) => `s = ${rect(b.s)}\\ (K = ${n(b.K)})`).join(',\\ '),
    });
  if (crossings.length) {
    summary.push({
      label: 'Ganancia crítica',
      value: crossings
        .map((c) => `K = ${n(c.K)},\\ \\omega = ${n(c.omega)}\\ \\text{rad/s}`)
        .join(';\\ '),
      emphasis: true,
    });
  } else {
    summary.push({ label: 'Cruces con jω', value: '\\text{ninguno}' });
  }
  if (zetaPoints.length)
    summary.push({
      label: `ζ = ${formatNumber(input.zeta!, DIGITS)}`,
      value: zetaPoints.map((p) => `s = ${rect(p.s)},\\ K = ${n(p.K)}`).join(';\\ '),
    });
  if (summary.length && !summary.some((s) => s.emphasis)) summary[0]!.emphasis = true;

  return {
    ok: true,
    value: {
      poles: data.poles,
      zeros: data.zeros,
      asymptotes: asym,
      realAxis: segments,
      breakaway,
      departures: departures.map(({ root, kind, angle }) => ({ root, kind, angle })),
      crossings,
      dampingPoints: zetaPoints,
      closedLoop,
    },
    summary,
    steps,
    tables,
    series,
    notices,
  };
}

export const lugarGeometricoDeLasRaices: Calculator<
  RootLocusInput,
  RootLocusValue,
  RootLocusErrorCode
> = {
  meta: {
    id: 'lugar-geometrico-de-las-raices',
    title: 'Lugar geométrico de las raíces',
    summary: 'Construye el LGR y determina la ganancia y la frecuencia críticas.',
    citations: [
      {
        sourceId: 'ogata-1998',
        locator: 'Sec. 6-2 (ejemplos 6-1 y 6-2) y sec. 6-3 (reglas generales)',
      },
      { sourceId: 'kuo-1996', locator: 'Cap. 8' },
    ],
  },
  inputSchema,
  // Ogata, ejemplo 6-1: K/[s(s + 1)(s + 2)] y ζ = 0.5.
  example: { openLoop: 'K/(s(s + 1)(s + 2))', zeta: 0.5 },
  solve: solveRootLocus,
};
