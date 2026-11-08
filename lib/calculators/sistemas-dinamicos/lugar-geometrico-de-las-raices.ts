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
import { formatNumber, toLatexNumber, TEX } from '@/lib/math/format';
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
  type LocusData,
} from './root-locus';
import { parseTf, rootsText, tfTex } from './transfer-function';
import { polyRoots } from '@/lib/math/polynomials';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
const deg = (v: number) => String.raw`${n(v)}^{\circ}`;
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

/** K·N en LaTeX: `K` si N = 1 y `K(N)` en otro caso. */
function gainTimesTex(poly: number[], variable = 's'): string {
  if (poly.length === 1 && poly[0] === 1) return 'K';
  return String.raw`K\left(${laplacePolyTex(poly, variable)}\right)`;
}

/** D_r(ω) + K·N_r(ω) (o la parte imaginaria), sin los términos nulos. */
function partTex(d: number[], nn: number[]): string {
  const omega = String.raw`\omega`;
  const dTex = d.every((c) => c === 0) ? '' : laplacePolyTex(d, omega);
  const kTex = nn.every((c) => c === 0) ? '' : gainTimesTex(nn, omega);
  if (!dTex) return kTex || '0';
  return kTex ? `${dTex} + ${kTex}` : dTex;
}

const intervalTex = ([a, b]: [number, number]) =>
  String.raw`${Number.isFinite(a) ? n(a) : TEX.negInfty} < \sigma < ${Number.isFinite(b) ? n(b) : TEX.infty}`;

type LocusPoint = { s: Complex; K: number };

function breakawayStep(breaks: ReturnType<typeof breakPoints>): Step {
  const list = breaks.points
    .map((p) => {
      const verdict = p.valid ? ' (sí)' : ' (no está en el lugar)';
      return `s = ${C.toTextRect(p.s, DIGITS)} da K = ${formatNumber(p.K, DIGITS)}${verdict}`;
    })
    .join('; ');
  return {
    title: 'Puntos de ruptura (desprendimiento e ingreso)',
    explanation: `Son raíces múltiples de la ecuación característica: de K = −D(s)/N(s) se pide dK/ds = 0. Solo cuentan las raíces con K real y positiva (están sobre el lugar). ${list}.`,
    formula: String.raw`\frac{dK}{ds} = 0 \iff N(s)D'(s) - N'(s)D(s) = 0`,
    result: `${laplacePolyTex(breaks.polynomial)} = 0`,
  };
}

const THETA = String.raw`\theta`;
const PHI = String.raw`\phi`;

function departureStep(departures: ReturnType<typeof departureAngles>): Step {
  return {
    title: 'Ángulos de salida y de llegada',
    explanation:
      'Para un polo complejo: θ = 180° − Σ(ángulos desde los otros polos) + Σ(ángulos desde los ceros). Para un cero complejo: φ = 180° + Σ(ángulos desde los polos) − Σ(ángulos desde los otros ceros). Los conjugados tienen el ángulo opuesto.',
    children: departures.map((d) => ({
      title: `${d.kind === 'polo' ? 'Salida del polo' : 'Llegada al cero'} ${C.toTextRect(d.root, DIGITS)}`,
      substitution: d.others
        .map(
          (o) =>
            String.raw`\angle(${rect(d.root)} - (${rect(o.from)})) = ${deg(o.angle)}\ (${o.kind})`,
        )
        .join(String.raw`,\ `),
      result: `${d.kind === 'polo' ? THETA : PHI} = ${deg(d.angle)}`,
    })),
  };
}

/** Puntos del lugar con el ζ pedido y la ganancia en cada uno. */
function dampingStep(data: LocusData, zeta: number, zetaPoints: LocusPoint[]): Step {
  const beta = C.degrees(Math.acos(zeta));
  const found = zetaPoints.length > 0;
  return {
    title: `Ganancia para ζ = ${formatNumber(zeta, DIGITS)}`,
    explanation: found
      ? `Los polos con ese amortiguamiento están sobre la recta que forma ±cos⁻¹ζ = ±${formatNumber(beta, DIGITS)}° con el eje real negativo. Donde la recta corta el lugar se cumple la condición de ángulo; K sale de la condición de magnitud.`
      : 'La recta de ese factor de amortiguamiento no corta el lugar.',
    formula: String.raw`K = \left|\frac{D(s)}{N(s)}\right|`,
    result: found
      ? zetaPoints
          .map((p) => String.raw`s = ${rect(p.s)},\ K = ${n(p.K)}`)
          .join(String.raw`;\quad `)
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
  };
}

function gainStep(gain: number, closedLoop: Complex[]): Step {
  const unstable = closedLoop.some((r) => r.re > 1e-9);
  return {
    title: `Polos en lazo cerrado con K = ${formatNumber(gain, DIGITS)}`,
    explanation: unstable
      ? 'Hay polos con parte real positiva: el sistema es inestable con esta ganancia.'
      : undefined,
    formula: String.raw`D(s) + K\,N(s) = 0`,
    result: closedLoop
      .filter((r) => r.im >= -1e-12)
      .map((r) => `s = ${rect(r)}`)
      .join(String.raw`,\ `),
  };
}

/** Lo que se calculó del lugar y se dibuja o se resume. */
interface LocusFindings {
  data: LocusData;
  asym: ReturnType<typeof asymptotes>;
  breakaway: LocusPoint[];
  crossings: { omega: number; K: number }[];
  zetaPoints: LocusPoint[];
  closedLoop: Complex[] | null;
}

/** Recta desde `from` en la dirección `angle` (radianes), hasta 2·radio. */
function rayPoints(from: Complex, angle: number, radius: number): Point[] {
  const end = C.add(from, C.fromPolar(2 * radius, angle));
  return [
    { x: from.re, y: from.im },
    { x: end.re, y: end.im },
  ];
}

function locusSeries(found: LocusFindings, zeta: number | undefined): Series {
  const { data, asym, breakaway, crossings, zetaPoints, closedLoop } = found;
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
  // Todas las ramas comparten etiqueta: la leyenda muestra una sola entrada.
  const curves: NonNullable<Series['curves']> = branches.map((points) => ({
    label: 'Lugar de las raíces',
    points,
  }));
  if (asym) {
    const centroid = C.complex(asym.centroid);
    for (const angle of asym.angles) {
      curves.push({
        label: 'Asíntota',
        points: rayPoints(centroid, C.radians(angle), radius),
        dashed: true,
      });
    }
  }
  if (zeta !== undefined) {
    curves.push({
      label: `ζ = ${formatNumber(zeta, 4)}`,
      points: rayPoints(C.complex(0), Math.PI - Math.acos(zeta), radius),
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
  return {
    id: 'lgr',
    title: 'Lugar geométrico de las raíces',
    xLabel: 'Re(s)',
    yLabel: 'Im(s)',
    kind: 'plane',
    points: [],
    curves,
    markers,
  };
}

function pointsTable(found: LocusFindings, zeta: number | undefined): ResultTable {
  const { breakaway, crossings, zetaPoints } = found;
  return {
    id: 'puntos',
    title: 'Puntos notables',
    columns: [
      { key: 'punto', header: String.raw`\text{Punto}`, format: 'latex' },
      { key: 's', header: 's', format: 'latex' },
      { key: 'K', header: 'K' },
    ],
    rows: [
      ...breakaway.map((b) => ({ punto: String.raw`\text{Ruptura}`, s: rect(b.s), K: b.K })),
      ...crossings.map((c) => ({
        punto: String.raw`\text{Cruce con } j\omega`,
        s: String.raw`\pm j${n(c.omega)}`,
        K: c.K,
      })),
      ...zetaPoints.map((p) => ({
        punto: String.raw`\zeta = ${n(zeta!)}`,
        s: rect(p.s),
        K: p.K,
      })),
    ],
  };
}

function locusSummary(found: LocusFindings, zeta: number | undefined): SummaryItem[] {
  const { asym, breakaway, crossings, zetaPoints } = found;
  const summary: SummaryItem[] = [];
  if (asym)
    summary.push({
      label: 'Asíntotas',
      value: String.raw`${asym.angles.map(deg).join(TEX.listSep)},\ \sigma_a = ${n(asym.centroid)}`,
    });
  if (breakaway.length)
    summary.push({
      label: 'Ruptura',
      value: breakaway
        .map((b) => String.raw`s = ${rect(b.s)}\ (K = ${n(b.K)})`)
        .join(String.raw`,\ `),
    });
  if (crossings.length) {
    summary.push({
      label: 'Ganancia crítica',
      value: crossings
        .map((c) => String.raw`K = ${n(c.K)},\ \omega = ${n(c.omega)}\ \text{rad/s}`)
        .join(String.raw`;\ `),
      emphasis: true,
    });
  } else {
    summary.push({ label: 'Cruces con el eje imaginario', value: String.raw`\text{ninguno}` });
  }
  if (zetaPoints.length) {
    const list = zetaPoints
      .map((p) => String.raw`s = ${rect(p.s)},\ K = ${n(p.K)}`)
      .join(String.raw`;\ `);
    summary.push({
      // El rótulo se muestra en mayúsculas: la ζ va en el valor, no en el rótulo.
      label: 'Amortiguamiento pedido',
      value: String.raw`\zeta = ${n(zeta!)}:\ ${list}`,
    });
  }
  if (summary.length && !summary.some((s) => s.emphasis)) summary[0]!.emphasis = true;
  return summary;
}

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
  const F = parsed.tf;

  const zerosText = data.m ? rootsText(polyRoots(F.num)) : 'ninguno';
  const toInfinity = data.n > data.m ? `; ${data.n - data.m} van al infinito` : '';
  steps.push(
    {
      title: 'Ecuación característica',
      explanation: `Los polos en lazo cerrado son las raíces de 1 + KG(s)H(s) = 0 para K ≥ 0. Polos de lazo abierto (K = 0, inicio de las ramas): ${rootsText(polyRoots(F.den))}. Ceros de lazo abierto (fin de las ramas): ${zerosText}. Hay ${data.n} ramas${toInfinity}.`,
      formula: String.raw`1 + KG(s)H(s) = 0 \iff D(s) + K\,N(s) = 0`,
      result: String.raw`G(s)H(s) = ${tfTex(F)},\quad ${laplacePolyTex(F.den)} + ${gainTimesTex(F.num)} = 0`,
    },
    {
      title: 'Condiciones de ángulo y de magnitud',
      explanation:
        'Un punto s está en el lugar si el ángulo de G(s)H(s) es un múltiplo impar de 180°; la ganancia en ese punto sale de la condición de magnitud.',
      formula: String.raw`\angle G(s)H(s) = \pm 180^{\circ}(2k + 1),\qquad K = \frac{1}{|G(s)H(s)|}`,
    },
  );

  const segments = realAxisSegments(data);
  steps.push({
    title: 'Lugar sobre el eje real',
    explanation:
      'Un punto del eje real está en el lugar si a su derecha hay un número impar de polos y ceros reales (los complejos conjugados se cancelan).',
    result: segments.length
      ? segments.map(intervalTex).join(String.raw`,\quad `)
      : String.raw`\text{ningún tramo}`,
  });

  const asym = asymptotes(data);
  if (asym) {
    steps.push({
      title: 'Asíntotas',
      explanation: `n − m = ${asym.count} ramas tienden al infinito siguiendo las asíntotas.`,
      formula: String.raw`\text{Ángulos} = \frac{\pm 180^{\circ}(2k + 1)}{n - m},\qquad \sigma_a = \frac{\sum \text{polos} - \sum \text{ceros}}{n - m}`,
      substitution: String.raw`\sigma_a = \frac{(${n(data.poles.reduce((s, p) => s + p.re, 0))}) - (${n(data.zeros.reduce((s, z) => s + z.re, 0))})}{${asym.count}}`,
      result: String.raw`\text{Ángulos: } ${asym.angles.map(deg).join(TEX.listSep)},\qquad \sigma_a = ${n(asym.centroid)}`,
    });
  }

  const breaks = breakPoints(data);
  const breakaway = breaks.points.filter((p) => p.valid).map((p) => ({ s: p.s, K: p.K }));
  if (breaks.polynomial.length >= 2) steps.push(breakawayStep(breaks));

  const departures = departureAngles(data);
  if (departures.length) steps.push(departureStep(departures));

  const cross = axisCrossings(data);
  const crossings = cross.crossings.filter((c) => c.omega > 1e-9);
  const dSplit = splitJw(F.den);
  const nSplit = splitJw(F.num);
  steps.push({
    title: 'Cruces con el eje imaginario',
    explanation: crossings.length
      ? 'Se sustituye s = jω en la ecuación característica y se igualan a cero la parte real y la imaginaria (o se usa el arreglo de Routh). La ganancia del cruce es la ganancia crítica: para K mayores el sistema es inestable.'
      : 'Al sustituir s = jω no hay soluciones con K positiva y ω > 0: el lugar no cruza el eje imaginario.',
    formula: String.raw`D(j\omega) + K\,N(j\omega) = 0`,
    substitution: String.raw`\left(${partTex(dSplit.re, nSplit.re)}\right) + j\left(${partTex(dSplit.im, nSplit.im)}\right) = 0`,
    result: crossings.length
      ? crossings
          .map((c) => String.raw`\omega = \pm ${n(c.omega)}\ \text{rad/s},\ K = ${n(c.K)}`)
          .join(String.raw`;\quad `)
      : undefined,
  });

  let zetaPoints: LocusPoint[] = [];
  if (input.zeta !== undefined) {
    zetaPoints = dampingPoints(data, input.zeta);
    steps.push(dampingStep(data, input.zeta, zetaPoints));
  }

  let closedLoop: Complex[] | null = null;
  if (input.gain !== undefined) {
    closedLoop = closedLoopRoots(data, input.gain);
    steps.push(gainStep(input.gain, closedLoop));
  }

  const found: LocusFindings = { data, asym, breakaway, crossings, zetaPoints, closedLoop };
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
    summary: locusSummary(found, input.zeta),
    steps,
    tables: [pointsTable(found, input.zeta)],
    series: [locusSeries(found, input.zeta)],
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
