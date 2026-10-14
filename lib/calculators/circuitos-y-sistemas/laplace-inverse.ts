/**
 * Traza de la transformada inversa de Laplace por fracciones parciales, con el procedimiento de
 * Hayt (sec. 14.5) y Dorf (sec. 14.4): división larga si F no es propia, polos del denominador,
 * residuos (regla de "tapar" para polos simples y derivadas para polos repetidos), inversa término
 * a término con la tabla de pares y, si hay factores e^{−as}, el desplazamiento en el tiempo.
 *
 * La comparten la calculadora de la transformada inversa, la solución de ecuaciones diferenciales,
 * la convolución y las ecuaciones de estado.
 */
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import {
  deflate,
  evalPolyComplex,
  isZeroPoly,
  polyRoots,
  reduceRational,
  type Poly,
} from '@/lib/math/polynomials';
import type { ResultTable, Step } from '../types';
import {
  DIGITS,
  evaluatePieces,
  factoredTex,
  impulseTerms,
  joinTerms,
  piecesLatexTerms,
  polyTex,
  rationalTex,
  timePieces,
  type DelayedRational,
  type TimePiece,
} from './laplace';
import { subscript } from '@/lib/calculators/metodos-numericos/matrix';
import { partialFractions, type PoleExpansion } from './partial-fractions';

const n = (v: number) => toLatexNumber(v, DIGITS);
const rect = (z: Complex) => C.toLatexRect(z, DIGITS);

export interface InverseGroup {
  delay: number;
  /** Cociente de la división larga: impulsos y sus derivadas. */
  direct: Poly;
  poles: PoleExpansion[];
  pieces: TimePiece[];
}

export interface InverseLaplace {
  groups: InverseGroup[];
  /** f(t) en LaTeX (sin el "f(t) ="). */
  tex: string;
  hasImpulses: boolean;
  steps: Step[];
  table: ResultTable;
  evaluate(t: number): number;
}

/** Polo en LaTeX: `-2`, `-3 + j`, `0`. */
export function poleTex(p: Complex): string {
  return rect(p);
}

/** (s − p) en LaTeX: `s + 2`, `s`, `s + 3 - j`. */
function factorTex(p: Complex, variable: string): string {
  if (C.isZero(p)) return variable;
  if (p.im === 0) return `${variable} ${p.re < 0 ? '+' : '-'} ${n(Math.abs(p.re))}`;
  const neg = C.neg(p);
  const re = neg.re === 0 ? '' : `${neg.re < 0 ? '-' : '+'} ${n(Math.abs(neg.re))}`;
  const im = `${neg.im < 0 ? '-' : '+'} j${Math.abs(neg.im) === 1 ? '' : n(Math.abs(neg.im))}`;
  return `${variable} ${re} ${im}`.replace(/\s+/g, ' ');
}

function powerFactorTex(p: Complex, k: number, variable: string): string {
  const base = factorTex(p, variable);
  const needsParens = !C.isZero(p);
  if (k === 1) return base;
  return needsParens ? `\\left(${base}\\right)^{${k}}` : `${base}^{${k}}`;
}

/** Forma general de la expansión: `\frac{K_{1}}{s + 2} + \frac{K_{2}}{(s + 1)^{2}}`. */
export function expansionTemplate(poles: PoleExpansion[], variable: string, direct: Poly): string {
  const parts: string[] = [];
  if (direct.length > 0 && !isZeroPoly(direct)) parts.push(polyTex(direct, variable));
  let index = 1;
  for (const p of poles) {
    for (let k = 1; k <= p.multiplicity; k++) {
      parts.push(`\\frac{K_{${index}}}{${powerFactorTex(p.pole, k, variable)}}`);
      index++;
    }
  }
  return parts.join(' + ');
}

/** Expansión con los residuos calculados. */
export function expansionTex(poles: PoleExpansion[], variable: string, direct: Poly): string {
  const parts: string[] = [];
  if (direct.length > 0 && !isZeroPoly(direct)) parts.push(polyTex(direct, variable));
  for (const p of poles) {
    p.residues.forEach((r, i) => {
      if (C.isZero(r, 1e-12)) return;
      const value = C.isReal(r, 1e-12) ? n(r.re) : `\\left(${rect(r)}\\right)`;
      parts.push(`\\frac{${value}}{${powerFactorTex(p.pole, i + 1, variable)}}`);
    });
  }
  return parts.join(' + ').replace(/\+ \\frac\{-/g, '- \\frac{');
}

export function residueSteps(
  remainder: Poly,
  den: Poly,
  poles: PoleExpansion[],
  variable: string,
  fn: string,
): Step[] {
  const steps: Step[] = [];
  let index = 1;
  for (const p of poles) {
    const m = p.multiplicity;
    const isLowerConjugate = p.pole.im < 0;
    for (let k = 1; k <= m; k++) {
      const residue = p.residues[k - 1]!;
      const name = `K_{${index}}`;
      const textName = `K${subscript(index)}`;
      const textPole = C.toTextRect(p.pole, DIGITS);
      index++;
      if (isLowerConjugate) {
        steps.push({
          title: `Residuo ${textName} (polo ${textPole})`,
          explanation:
            'Es el conjugado del polo anterior, así que su residuo es el conjugado del residuo ya calculado.',
          result: `${name} = ${rect(residue)}`,
        });
        continue;
      }
      if (m === 1) {
        const rest = deflate(den, p.pole, 1);
        const numValue = evalPolyComplex(remainder, p.pole);
        const restValue = evalPolyComplex(rest, p.pole);
        steps.push({
          title: `Residuo ${textName} (polo ${textPole})`,
          explanation: 'Polo simple: se multiplica por el factor del polo y se evalúa en él.',
          formula: `${name} = \\left.(${factorTex(p.pole, variable)})\\,${fn}(${variable})\\right|_{${variable} = ${poleTex(p.pole)}}`,
          substitution: `${name} = \\frac{${rect(numValue)}}{${rect(restValue)}}`,
          result: `${name} = ${rect(residue)}`,
        });
        continue;
      }
      const order = m - k;
      const derivative =
        order === 0
          ? ''
          : order === 1
            ? `\\frac{d}{d${variable}}`
            : `\\frac{1}{${order}!}\\frac{d^{${order}}}{d${variable}^{${order}}}`;
      steps.push({
        title: `Residuo ${textName} (polo ${textPole} de multiplicidad ${m})`,
        explanation:
          order === 0
            ? 'Coeficiente de la potencia más alta: se multiplica por el factor elevado a la multiplicidad y se evalúa.'
            : `Polo repetido: se deriva ${order} ${order === 1 ? 'vez' : 'veces'} antes de evaluar.`,
        formula: `${name} = ${derivative}\\left[${powerFactorTex(p.pole, m, variable)}\\,${fn}(${variable})\\right]_{${variable} = ${poleTex(p.pole)}}`,
        result: `${name} = ${rect(residue)}`,
      });
    }
  }
  return steps;
}

function pairStep(p: PoleExpansion): Step | null {
  if (p.pole.im < 0) return null;
  const sigma = p.pole.re;
  const children: Step[] = [];
  p.residues.forEach((residue, index) => {
    if (C.isZero(residue, 1e-12)) return;
    const k = index + 1;
    const piece = timePieces([
      { pole: p.pole, multiplicity: k, residues: [...Array<Complex>(k - 1).fill(C.ZERO), residue] },
    ]);
    const time = joinTerms(piecesLatexTerms(piece, 't'));
    if (p.pole.im === 0) {
      const general =
        k === 1
          ? `\\frac{K}{s - p} \\leftrightarrow K e^{pt}`
          : `\\frac{K}{(s - p)^{k}} \\leftrightarrow K \\frac{t^{k-1}}{(k-1)!} e^{pt}`;
      children.push({
        title: `Polo real ${C.toTextRect(p.pole, DIGITS)}${k > 1 ? `, orden ${k}` : ''}`,
        formula: general,
        result: time,
      });
    } else {
      const magnitude = 2 * C.abs(residue);
      const angle = C.degrees(C.arg(residue));
      children.push({
        title: `Par complejo ${C.toTextRect(p.pole, DIGITS)} y su conjugado${k > 1 ? `, orden ${k}` : ''}`,
        explanation: `Con K = |K|∠θ: 2|K| = ${formatNumber(magnitude, DIGITS)} y θ = ${formatNumber(angle, DIGITS)}°.`,
        formula:
          k === 1
            ? `\\frac{K}{s - p} + \\frac{K^{*}}{s - p^{*}} \\leftrightarrow 2|K| e^{\\sigma t}\\cos(\\omega t + \\theta) = 2\\,\\mathrm{Re}(K)\\,e^{\\sigma t}\\cos\\omega t - 2\\,\\mathrm{Im}(K)\\,e^{\\sigma t}\\sin\\omega t`
            : `\\frac{K}{(s - p)^{k}} + \\frac{K^{*}}{(s - p^{*})^{k}} \\leftrightarrow \\frac{2|K|\\,t^{k-1}}{(k-1)!} e^{\\sigma t}\\cos(\\omega t + \\theta)`,
        substitution: `\\sigma = ${n(sigma)},\\ \\omega = ${n(p.pole.im)}`,
        result: time,
      });
    }
  });
  if (children.length === 0) return null;
  return children.length === 1
    ? children[0]!
    : { title: `Polo ${C.toTextRect(p.pole, DIGITS)}`, children };
}

/** Retardo como variable desplazada: `t - 2`. */
function shiftedVariable(delay: number): string {
  return delay === 0 ? 't' : `t - ${n(delay)}`;
}

/**
 * f_a(t − a)·u(t − a) en LaTeX. Un solo término se escribe con el escalón pegado
 * (`-u(t - 1)`, `2e^{-(t - 1)}u(t - 1)`); varios van entre corchetes.
 */
export function delayedTex(delay: number, direct: Poly, pieces: TimePiece[]): string {
  const variable = shiftedVariable(delay);
  const terms = [
    ...impulseTerms(direct.length ? direct : [], variable),
    ...piecesLatexTerms(pieces, variable),
  ];
  if (delay === 0) return joinTerms(terms);
  const step = `u\\left(${variable}\\right)`;
  if (terms.length === 1) {
    const [term] = terms;
    return joinTerms([{ coef: term!.coef, body: term!.body ? `${term!.body}\\,${step}` : step }]);
  }
  return `\\left[${joinTerms(terms)}\\right]${step}`;
}

/** Une sumandos ya escritos en LaTeX respetando los signos. */
export function joinParts(parts: string[]): string {
  const filled = parts.filter((p) => p !== '' && p !== '0');
  if (filled.length === 0) return '0';
  return filled
    .map((part, i) => {
      if (i === 0) return part;
      return part.startsWith('-') ? `- ${part.slice(1).trimStart()}` : `+ ${part}`;
    })
    .join(' ');
}

/**
 * Inversa completa de F(s) = Σ e^{−as} N_a(s)/D_a(s). `fn` es el nombre de la función en s
 * (`F`, `Y`, `X_1`…) y `timeFn` el de la función del tiempo (`f`, `y`…).
 */
export function inverseLaplace(
  groups: DelayedRational[],
  fn = 'F',
  timeFn = 'f',
): { ok: true; result: InverseLaplace } | { ok: false; message: string } {
  const variable = 's';
  const steps: Step[] = [];
  const out: InverseGroup[] = [];
  const tableRows: ResultTable['rows'] = [];
  const multi = groups.length > 1 || groups.some((g) => g.delay > 0);

  for (const group of groups) {
    if (isZeroPoly(group.den)) return { ok: false, message: 'El denominador es 0.' };
    const { num, den, reduced } = reduceRational(group.num, group.den);
    const pf = partialFractions(num, den);
    const roots = polyRoots(den);
    const groupSteps: Step[] = [];
    const label = group.delay > 0 ? `${fn}_{${n(group.delay)}}` : multi ? `${fn}_{0}` : fn;

    groupSteps.push({
      title: 'Función racional',
      explanation:
        [
          group.delay > 0 &&
            `Este término viene multiplicado por e^(−as) con a = ${formatNumber(group.delay, DIGITS)}; primero se invierte la parte racional.`,
          reduced && 'Se cancelaron los factores comunes del numerador y el denominador.',
        ]
          .filter(Boolean)
          .join(' ') || undefined,
      formula: `${label}(s) = ${reduced ? `${rationalTex(group.num, group.den, variable)} = ` : ''}${rationalTex(num, den, variable)}`,
    });

    if (pf.direct.length > 0) {
      groupSteps.push({
        title: 'División larga (la función no es propia)',
        explanation:
          'El grado del numerador no es menor que el del denominador: se divide para separar un polinomio y una fracción propia.',
        result: `${label}(s) = ${polyTex(pf.direct, variable)} + ${rationalTex(pf.remainder, den, variable)}`,
      });
    }

    if (den.length > 1) {
      groupSteps.push({
        title: 'Polos (raíces del denominador)',
        formula: `${polyTex(den, variable)} = 0`,
        result: `${polyTex(den, variable)} = ${factoredTex(roots, den[0]!, variable)}`,
        explanation: `Polos: ${roots
          .map(
            (r) =>
              `${C.toTextRect(r.value, DIGITS)}${r.multiplicity > 1 ? ` (multiplicidad ${r.multiplicity})` : ''}`,
          )
          .join(', ')}.`,
      });
      groupSteps.push({
        title: 'Forma de la expansión en fracciones parciales',
        formula: `${label}(s) = ${expansionTemplate(pf.poles, variable, pf.direct)}`,
      });
      groupSteps.push({
        title: 'Cálculo de los residuos',
        children: residueSteps(pf.remainder, den, pf.poles, variable, label),
      });
      groupSteps.push({
        title: 'Expansión',
        result: `${label}(s) = ${expansionTex(pf.poles, variable, pf.direct)}`,
      });
    }

    const pieces = timePieces(pf.poles);
    const pairSteps = pf.poles.map((p) => pairStep(p)).filter((s): s is Step => s !== null);
    const impulses = impulseTerms(pf.direct.length ? pf.direct : [], 't');
    if (impulses.length > 0) {
      pairSteps.unshift({
        title: 'Parte polinomial',
        formula: `1 \\leftrightarrow \\delta(t),\\quad s \\leftrightarrow \\delta'(t)`,
        result: joinTerms(impulses),
      });
    }
    const local = joinTerms([...impulses, ...piecesLatexTerms(pieces, 't')]);
    const timeLabel =
      group.delay > 0 ? `${timeFn}_{${n(group.delay)}}` : multi ? `${timeFn}_{0}` : timeFn;
    groupSteps.push({
      title: 'Transformada inversa término a término',
      children: pairSteps,
      result: `${timeLabel}(t) = ${local}`,
    });

    if (group.delay > 0) {
      groupSteps.push({
        title: 'Desplazamiento en el tiempo',
        formula: `e^{-as}F(s) \\leftrightarrow f(t - a)\\,u(t - a)`,
        result: delayedTex(group.delay, pf.direct, pieces),
      });
    }

    if (multi) {
      steps.push({
        title:
          group.delay > 0
            ? `Término con e^(−${formatNumber(group.delay, DIGITS)}s)`
            : 'Término sin retardo',
        children: groupSteps,
      });
    } else {
      steps.push(...groupSteps);
    }

    for (const p of pf.poles) {
      p.residues.forEach((r, i) => {
        tableRows.push({
          retardo: n(group.delay),
          polo: poleTex(p.pole),
          orden: i + 1,
          residuo: rect(r),
          modulo: C.abs(r),
          angulo: C.degrees(C.arg(r)),
        });
      });
    }
    out.push({ delay: group.delay, direct: pf.direct, poles: pf.poles, pieces });
  }

  const tex = joinParts(out.map((g) => delayedTex(g.delay, g.direct, g.pieces)));

  const columns: ResultTable['columns'] = [
    ...(multi ? [{ key: 'retardo', header: 'a' }] : []),
    { key: 'polo', header: 'p', format: 'latex' },
    { key: 'orden', header: 'k' },
    { key: 'residuo', header: 'K', format: 'latex' },
    { key: 'modulo', header: '|K|' },
    { key: 'angulo', header: '\\angle K\\,(^{\\circ})' },
  ];

  return {
    ok: true,
    result: {
      groups: out,
      tex,
      hasImpulses: out.some((g) => g.direct.length > 0 && !isZeroPoly(g.direct)),
      steps,
      table: { id: 'residuos', title: 'Polos y residuos', columns, rows: tableRows },
      evaluate: (t: number) =>
        out.reduce(
          (sum, g) => (t >= g.delay - 1e-12 ? sum + evaluatePieces(g.pieces, t - g.delay) : sum),
          0,
        ),
    },
  };
}
