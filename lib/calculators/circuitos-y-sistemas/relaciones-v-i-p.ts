/**
 * Relaciones v-i-p para elementos pasivos en el dominio del tiempo.
 *
 * Dada una función de voltaje o corriente v(t) o i(t), calcula la otra variable y la potencia
 * instantánea según la relación constitutiva del elemento. Para capacitores e inductores con
 * corriente o voltaje conocida, respectivamente, se integra numéricamente asumiendo condición
 * inicial cero (se advierte en la traza).
 *
 * Fuentes: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 5.
 */
import { derivative } from 'mathjs';
import { z } from 'zod';
import { expressionFromNode, parseFunction } from '@/lib/math/expression';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Calculator, CalculatorResult, Series, Step } from '../types';

const relacionesInputSchema = z.object({
  component: z.enum(['resistor', 'capacitor', 'inductor']),
  known: z.enum(['voltage', 'current']),
  expression: z.string().min(1, 'Ingresa una expresión para v(t) o i(t).'),
  value: z.number().positive('El valor debe ser mayor que cero.'),
  tEnd: z.number().positive(),
  samples: z.number().int().min(50).max(2000),
});

export type RelacionesVipInput = z.infer<typeof relacionesInputSchema>;

export interface RelacionesVipValue {
  vExpr: string;
  iExpr: string;
  pExpr: string;
  vLatex: string;
  iLatex: string;
  pLatex: string;
  series: Series;
}

export type RelacionesVipErrorCode = 'expresion-invalida' | 'dominio';

const COMPONENT_NAMES: Record<RelacionesVipInput['component'], string> = {
  resistor: 'resistencia',
  capacitor: 'capacitor',
  inductor: 'inductor',
};

const SYMBOL: Record<RelacionesVipInput['component'], string> = {
  resistor: 'R',
  capacitor: 'C',
  inductor: 'L',
};

function sample(
  f: (t: number) => number,
  tEnd: number,
  samples: number,
): { t: number; value: number }[] {
  const points: { t: number; value: number }[] = [];
  for (let k = 0; k <= samples; k++) {
    const t = (k * tEnd) / samples;
    points.push({ t, value: f(t) });
  }
  return points;
}

function makeSeries(
  input: RelacionesVipInput,
  v: (t: number) => number,
  i: (t: number) => number,
): Series {
  const samples = input.samples;
  const tEnd = input.tEnd;
  const vPoints = sample(v, tEnd, samples);
  const iPoints = sample(i, tEnd, samples);
  const pPoints = vPoints.map((p, idx) => ({ x: p.t, y: p.value * iPoints[idx]!.value }));
  return {
    id: 'vip',
    title: 'Relaciones v-i-p en el tiempo',
    xLabel: 't (s)',
    yLabel: 'v (V), i (A), p (W)',
    points: vPoints.map((p) => ({ x: p.t, y: p.value })),
    others: [
      { label: 'i(t)', points: iPoints.map((p) => ({ x: p.t, y: p.value })) },
      { label: 'p(t)', points: pPoints },
    ],
  };
}

export function solveRelacionesVip(
  input: RelacionesVipInput,
): CalculatorResult<RelacionesVipValue, RelacionesVipErrorCode> {
  const parsed = parseFunction(input.expression, ['t']);
  if (!parsed.ok) {
    return {
      ok: false,
      error: { code: 'expresion-invalida', message: 'La expresión ingresada no es válida.' },
      ...emptyTrace(),
    };
  }
  const f = (t: number) => parsed.expr.evaluateAt({ t });

  let vExpr: string;
  let iExpr: string;
  let vLatex: string;
  let iLatex: string;
  let v: (t: number) => number;
  let i: (t: number) => number;

  const c = input.component;
  const val = input.value;
  const symbol = SYMBOL[c];

  try {
    if (input.known === 'voltage') {
      vExpr = input.expression;
      vLatex = `v(t) = ${parsed.expr.tex}`;
      v = f;
      if (c === 'resistor') {
        iExpr = `(${input.expression}) / ${val}`;
        iLatex = `i(t) = \\frac{${parsed.expr.tex}}{${toLatexNumber(val)}\\,${symbol}}`;
        i = (t) => f(t) / val;
      } else if (c === 'capacitor') {
        const d = derivative(parsed.expr.node, 't');
        const di = expressionFromNode(d, ['t']);
        iExpr = `${val} * (${di.toString()})`;
        iLatex = `i(t) = ${toLatexNumber(val)}\\,${symbol} \\cdot \\frac{dv}{dt} = ${val === 1 ? '' : toLatexNumber(val)}${di.tex}`;
        i = (t) => val * di.evaluateAt({ t });
      } else {
        // inductor, known voltage
        // i(t) = (1/L) * integral v dt  → numeric
        const { evalFn } = numericIntegral(f, input.tEnd, input.samples, 1 / val);
        iExpr = `(1/${val}) * ∫(${input.expression}) dt`;
        iLatex = `i(t) = \\frac{1}{${toLatexNumber(val)}\\,${symbol}} \\int_0^t ${parsed.expr.tex} \\, d\\tau`;
        i = evalFn;
      }
    } else {
      // known current
      iExpr = input.expression;
      iLatex = `i(t) = ${parsed.expr.tex}`;
      i = f;
      if (c === 'resistor') {
        vExpr = `${val} * (${input.expression})`;
        vLatex = `v(t) = ${toLatexNumber(val)}\\,${symbol} \\cdot ${parsed.expr.tex}`;
        v = (t) => val * f(t);
      } else if (c === 'inductor') {
        const d = derivative(parsed.expr.node, 't');
        const dv = expressionFromNode(d, ['t']);
        vExpr = `${val} * (${dv.toString()})`;
        vLatex = `v(t) = ${toLatexNumber(val)}\\,${symbol} \\cdot \\frac{di}{dt} = ${val === 1 ? '' : toLatexNumber(val)}${dv.tex}`;
        v = (t) => val * dv.evaluateAt({ t });
      } else {
        // capacitor, known current
        const { evalFn } = numericIntegral(f, input.tEnd, input.samples, 1 / val);
        vExpr = `(1/${val}) * ∫(${input.expression}) dt`;
        vLatex = `v(t) = \\frac{1}{${toLatexNumber(val)}\\,${symbol}} \\int_0^t ${parsed.expr.tex} \\, d\\tau`;
        v = evalFn;
      }
    }
  } catch {
    return {
      ok: false,
      error: {
        code: 'dominio',
        message: 'No se pudo evaluar la expresión en el intervalo de tiempo.',
      },
      ...emptyTrace(),
    };
  }

  const pExpr = `(${vExpr}) * (${iExpr})`;
  const pLatex = `p(t) = v(t)\\cdot i(t)`;

  const series = makeSeries(input, v, i);
  const pAtZero = v(0) * i(0);

  const steps: Step[] = [
    {
      title: 'Relación constitutiva',
      explanation: `Se trabaja con una ${COMPONENT_NAMES[c]}. Convención pasiva: la corriente entra por el terminal de voltaje positivo.`,
      formula:
        c === 'resistor'
          ? 'v(t) = R\\,i(t)'
          : c === 'capacitor'
            ? 'i(t) = C\\,\\frac{dv}{dt}'
            : 'v(t) = L\\,\\frac{di}{dt}',
    },
    {
      title: input.known === 'voltage' ? 'Voltaje dado' : 'Corriente dada',
      formula: input.known === 'voltage' ? vLatex : iLatex,
    },
    {
      title: input.known === 'voltage' ? 'Corriente resultante' : 'Voltaje resultante',
      formula: input.known === 'voltage' ? iLatex : vLatex,
    },
    {
      title: 'Potencia instantánea',
      explanation:
        'La potencia instantánea es el producto del voltaje por la corriente en cada instante.',
      formula: pLatex,
      result: `p(0) = ${toLatexNumber(pAtZero)}\\text{ W}`,
    },
  ];

  const value: RelacionesVipValue = {
    vExpr,
    iExpr,
    pExpr,
    vLatex,
    iLatex,
    pLatex,
    series,
  };

  return {
    ok: true,
    value,
    summary: [
      { label: 'v(0)', value: `${formatNumber(v(0), 4)}\\text{ V}` },
      { label: 'i(0)', value: `${formatNumber(i(0), 4)}\\text{ A}` },
      { label: 'p(0)', value: `${formatNumber(pAtZero, 4)}\\text{ W}` },
    ],
    steps,
    tables: [],
    series: [series],
    notices:
      c === 'capacitor' && input.known === 'current'
        ? [
            {
              level: 'info',
              message: 'Se asume v(0) = 0 V (condición inicial cero) al integrar la corriente.',
            },
          ]
        : c === 'inductor' && input.known === 'voltage'
          ? [
              {
                level: 'info',
                message: 'Se asume i(0) = 0 A (condición inicial cero) al integrar el voltaje.',
              },
            ]
          : [],
  };
}

function numericIntegral(
  f: (t: number) => number,
  tEnd: number,
  samples: number,
  scale: number,
): { evalFn: (t: number) => number } {
  const dt = tEnd / samples;
  const acc: { t: number; value: number }[] = [{ t: 0, value: 0 }];
  for (let k = 1; k <= samples; k++) {
    const t = k * dt;
    const prev = acc[k - 1]!;
    const fk = f(t);
    const fkm1 = f(prev.t);
    const area = ((fk + fkm1) / 2) * dt;
    acc.push({ t, value: prev.value + area * scale });
  }
  return {
    evalFn: (t: number) => {
      if (t <= 0) return 0;
      if (t >= tEnd) return acc[acc.length - 1]!.value;
      const idx = Math.floor((t / tEnd) * samples);
      const a = acc[idx]!;
      const b = acc[idx + 1] ?? a;
      const frac = (t - a.t) / (b.t - a.t || 1);
      return a.value + frac * (b.value - a.value);
    },
  };
}

function emptyTrace() {
  return { steps: [], tables: [], series: [], notices: [] };
}

export const relacionesVip: Calculator<
  RelacionesVipInput,
  RelacionesVipValue,
  RelacionesVipErrorCode
> = {
  meta: {
    id: 'relaciones-v-i-p',
    title: 'Relaciones v-i-p',
    summary:
      'Calcula voltaje, corriente y potencia instantánea de R, L o C a partir de una función de tiempo.',
    citations: [{ sourceId: 'hayt-kemmerly-1993', locator: 'Capítulo 5' }],
  },
  inputSchema: relacionesInputSchema,
  example: {
    component: 'capacitor',
    known: 'voltage',
    expression: '10*sin(t)',
    value: 0.5,
    tEnd: 5,
    samples: 400,
  },
  solve: solveRelacionesVip,
};
