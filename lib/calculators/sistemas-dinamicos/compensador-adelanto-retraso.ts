/**
 * Diseño de compensadores de adelanto y de atraso de fase, por el lugar de las raíces o por el
 * diagrama de Bode (Ogata, 3.ª ed.):
 *
 *   adelanto por LGR (sec. 7-3, ejemplo 7-1): deficiencia de ángulo φ en el polo deseado, cero y
 *     polo por el método de la bisectriz y K por la condición de magnitud;
 *   atraso por LGR (sec. 7-4, ejemplo 7-2): cero y polo cerca del origen con z/p = β, los nuevos
 *     polos dominantes con el mismo ζ y K̂c por la condición de magnitud;
 *   adelanto por Bode (sec. 9-2, ejemplo 9-1): K por la constante de error, φm = γ_d − γ + margen,
 *     α = (1 − sen φm)/(1 + sen φm), ωc donde |KG| = √α, 1/T = √α·ωc y Kc = K/α;
 *   atraso por Bode (sec. 9-3, ejemplo 9-2): ωc donde la fase vale −180° + γ_d + tolerancia,
 *     β = |KG(jωc)|, cero una década por debajo de ωc y Kc = K/β.
 *
 * Gc(s) = Kc (s + 1/T)/(s + 1/(αT)) (adelanto, α < 1) o Kc (s + 1/T)/(s + 1/(βT)) (atraso, β > 1).
 */
import { z } from 'zod';
import * as C from '@/lib/math/complex';
import type { Complex } from '@/lib/math/complex';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import { addPoly, evalPolyComplex, mulPoly, polyRoots, trimPoly } from '@/lib/math/polynomials';
import type { Calculator, CalculatorResult, Notice, Series, Step, SummaryItem } from '../types';
import { bodeForm, logGrid, magnitude, margins, phaseDeg, frequencyRange } from './frequency';
import { dampingPoints, locusData } from './root-locus';
import { horizonFor, sample, timeResponse } from './time-response';
import {
  lowFrequencyGain,
  parseTf,
  rootsText,
  systemType,
  tfMul,
  tfTex,
  type TransferFunction,
} from './transfer-function';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);
const deg = (v: number) => `${n(v)}^{\\circ}`;
const rect = (z: Complex) => C.toLatexRect(z, DIGITS);
const positive = (what: string) =>
  z
    .number({ error: `Escribe ${what}.` })
    .refine(Number.isFinite, `Escribe ${what}.`)
    .refine((v) => v > 0, `${what} debe ser mayor que 0.`);
const optionalPositive = (what: string) =>
  z
    .number()
    .refine((v) => v > 0, `${what} debe ser mayor que 0.`)
    .optional();

const inputSchema = z.object({
  mode: z.enum(['lgr-adelanto', 'lgr-atraso', 'bode-adelanto', 'bode-atraso']),
  plant: z.string().trim().min(1, 'Escribe G(s).').max(200, 'G(s) es demasiado larga.'),
  // Adelanto por LGR: polos dominantes deseados.
  zeta: z.number().refine((v) => v > 0 && v < 1, 'ζ debe estar entre 0 y 1.'),
  omegaN: positive('ωₙ'),
  // Atraso por LGR.
  lagBeta: z.number().refine((v) => v > 1, 'β debe ser mayor que 1.'),
  lagZero: positive('el cero del compensador'),
  // Por Bode.
  errorConstant: positive('la constante de error'),
  phaseMargin: z
    .number()
    .refine((v) => v > 0 && v < 90, 'El margen de fase debe estar entre 0° y 90°.'),
  allowance: z
    .number()
    .refine((v) => v >= 0 && v <= 30, 'El margen adicional debe estar entre 0° y 30°.'),
  /** Adelanto máximo φm elegido (opcional; si falta, se calcula). */
  leadPhase: z
    .number()
    .refine((v) => v > 0 && v < 90, 'φm debe estar entre 0° y 90°.')
    .optional(),
  /** Nueva frecuencia de cruce elegida (opcional). */
  crossover: optionalPositive('ωc'),
  /** Esquina del cero del atraso elegida (opcional; por defecto ωc/10). */
  zeroFrequency: optionalPositive('el cero'),
});

export type CompensatorInput = z.infer<typeof inputSchema>;

export interface CompensatorValue {
  compensator: TransferFunction;
  /** Kc, cero y polo: Gc = Kc (s + zero)/(s + pole). */
  kc: number;
  zero: number;
  pole: number;
  /** α (adelanto) o β (atraso). */
  ratio: number;
  openLoop: TransferFunction;
  closedLoop: TransferFunction;
  /** Margen de fase y de ganancia del sistema compensado (métodos de Bode). */
  phaseMargin: number | null;
  gainMarginDb: number | null;
  /** Polos dominantes y constante de error del sistema compensado. */
  dominant: Complex | null;
  errorConstant: number;
  details: Record<string, number>;
}

export type CompensatorErrorCode = 'funcion-invalida' | 'sin-compensacion' | 'diseno-imposible';

function fail(
  code: CompensatorErrorCode,
  message: string,
  steps: Step[] = [],
): CalculatorResult<CompensatorValue, CompensatorErrorCode> {
  return {
    ok: false,
    error: { code, message },
    steps,
    tables: [],
    series: [],
    notices: [{ level: 'error', message }],
  };
}

const evalTf = (tf: TransferFunction, s: Complex) =>
  C.div(evalPolyComplex(tf.num, s), evalPolyComplex(tf.den, s));
const closedOf = (open: TransferFunction): TransferFunction => ({
  num: trimPoly(open.num),
  den: trimPoly(addPoly(open.den, open.num)),
});
const lead = (kc: number, zero: number, pole: number): TransferFunction => ({
  num: [kc, kc * zero],
  den: [1, pole],
});

function constantName(type: number): string {
  return type <= 0 ? 'K_p' : type === 1 ? 'K_v' : 'K_a';
}

/** Constante de error estático de G según su tipo (para tipo 0, K_p = G(0)). */
function errorConstantOf(G: TransferFunction): number {
  return lowFrequencyGain(G);
}

/** ω donde f(ω) cruza el nivel, buscando en una malla logarítmica. */
function solveFrequency(
  f: (w: number) => number,
  level: number,
  lo: number,
  hi: number,
): number | null {
  const grid = logGrid(lo, hi, 4000);
  for (let i = 1; i < grid.length; i++) {
    const a = f(grid[i - 1]!) - level;
    const b = f(grid[i]!) - level;
    if (Math.sign(a) !== Math.sign(b)) {
      let x = Math.log10(grid[i - 1]!);
      let y = Math.log10(grid[i]!);
      for (let k = 0; k < 100; k++) {
        const mid = (x + y) / 2;
        if (Math.sign(f(10 ** mid) - level) === Math.sign(a)) x = mid;
        else y = mid;
      }
      return 10 ** ((x + y) / 2);
    }
  }
  return null;
}

function dominantPole(roots: Complex[]): Complex | null {
  const complexes = roots.filter((r) => r.im > 1e-9);
  if (complexes.length === 0) return null;
  return complexes.reduce((a, b) => (b.re > a.re ? b : a));
}

export function solveCompensator(
  input: CompensatorInput,
): CalculatorResult<CompensatorValue, CompensatorErrorCode> {
  const parsed = parseTf(input.plant, 'G(s)');
  if (!parsed.ok) return fail('funcion-invalida', parsed.message);
  const G = parsed.tf;
  const steps: Step[] = [];
  const notices: Notice[] = [];
  const type = Math.max(0, systemType(G));
  const cName = constantName(type);
  let kc: number;
  let zero: number;
  let pole: number;
  let ratio: number;
  let reference: TransferFunction = G;
  const details: Record<string, number> = {};
  let dominant: Complex | null = null;

  steps.push({
    title: 'Planta',
    explanation: `Sistema de tipo ${type}; polos: ${rootsText(polyRoots(G.den))}.`,
    result: `G(s) = ${tfTex(G)}`,
  });

  if (input.mode === 'lgr-adelanto') {
    const { zeta, omegaN: wn } = input;
    const sd = C.complex(-zeta * wn, wn * Math.sqrt(1 - zeta * zeta));
    const angleG = C.degrees(C.arg(evalTf(G, sd)));
    // Deficiencia: lo que falta para que el ángulo total sea −180°.
    let phi = -180 - angleG;
    while (phi <= -180) phi += 360;
    while (phi > 180) phi -= 360;
    details.angleDeficiency = phi;
    steps.push({
      title: 'Polos dominantes deseados',
      formula: 's_d = -\\zeta\\omega_n \\pm j\\omega_n\\sqrt{1 - \\zeta^{2}}',
      substitution: `s_d = -(${n(zeta)})(${n(wn)}) \\pm j(${n(wn)})\\sqrt{1 - ${n(zeta)}^{2}}`,
      result: `s_d = ${rect(sd)}`,
    });
    steps.push({
      title: 'Deficiencia de ángulo',
      explanation:
        phi <= 1e-9
          ? 'El ángulo de G(s) en el polo deseado ya es −180° o menos negativo: basta un ajuste de ganancia o se necesita atraso, no adelanto.'
          : `Para que el lugar pase por s_d, el compensador debe aportar φ = ${formatNumber(phi, DIGITS)}° (Ogata, sec. 7-3).${phi > 60 ? ' Es un ángulo grande: puede convenir usar dos redes de adelanto.' : ''}`,
      formula: '\\phi = -180^{\\circ} - \\angle G(s_d)',
      substitution: `\\phi = -180^{\\circ} - (${deg(angleG)})`,
      result: `\\phi = ${deg(phi)}`,
    });
    if (phi <= 1e-9)
      return fail(
        'sin-compensacion',
        'G(s) no necesita adelanto de fase para pasar por el polo deseado.',
        steps,
      );
    // Método de la bisectriz: PA horizontal hacia la izquierda, PO hacia el origen.
    const toOrigin = C.degrees(Math.atan2(-sd.im, -sd.re)) + 360;
    const bisector = (180 + toOrigin) / 2;
    const hit = (angle: number) => {
      const a = C.radians(angle);
      const t = -sd.im / Math.sin(a);
      return sd.re + t * Math.cos(a);
    };
    const zeroAt = hit(bisector + phi / 2);
    const poleAt = hit(bisector - phi / 2);
    if (!(zeroAt < 0) || !(poleAt < zeroAt))
      return fail(
        'diseno-imposible',
        'Con este ángulo el método de la bisectriz no da un cero y un polo en el semieje real negativo.',
        steps,
      );
    zero = -zeroAt;
    pole = -poleAt;
    ratio = zero / pole;
    steps.push({
      title: 'Cero y polo por el método de la bisectriz',
      explanation:
        'Se traza por s_d una recta horizontal (PA) y la recta al origen (PO); se biseca el ángulo APO y se trazan dos rectas a ±φ/2 de la bisectriz. Sus cortes con el eje real son el cero y el polo del compensador; así α es lo más grande posible (Ogata, fig. 7-9).',
      result: `\\text{cero en } s = ${n(-zero)},\\quad \\text{polo en } s = ${n(-pole)},\\quad \\alpha = \\frac{${n(zero)}}{${n(pole)}} = ${n(ratio)}`,
    });
    const shape: TransferFunction = { num: [1, zero], den: [1, pole] };
    kc = 1 / C.abs(evalTf(tfMul(shape, G), sd));
    steps.push({
      title: 'Ganancia por la condición de magnitud',
      formula: '\\left|K_c\\frac{s_d + 1/T}{s_d + 1/(\\alpha T)}G(s_d)\\right| = 1',
      substitution: `K_c = \\frac{1}{\\left|\\frac{s_d + ${n(zero)}}{s_d + ${n(pole)}}G(s_d)\\right|}`,
      result: `K_c = ${n(kc)}`,
    });
  } else if (input.mode === 'lgr-atraso') {
    const uncompensatedClosed = closedOf(G);
    const poles0 = polyRoots(uncompensatedClosed.den).map((r) => r.value);
    const dom0 = dominantPole(poles0);
    if (!dom0)
      return fail(
        'diseno-imposible',
        'El sistema sin compensar no tiene polos dominantes complejos: este procedimiento parte de ellos.',
        steps,
      );
    const zeta = -dom0.re / C.abs(dom0);
    const kv0 = errorConstantOf(G);
    details.uncompensatedZeta = zeta;
    details.uncompensatedConstant = kv0;
    steps.push({
      title: 'Sistema sin compensar',
      explanation: `Polos en lazo cerrado: ${rootsText(polyRoots(uncompensatedClosed.den))}. Los dominantes tienen ζ = ${formatNumber(zeta, 4)} y ω_n = ${formatNumber(C.abs(dom0), 4)} rad/s. La respuesta transitoria es aceptable; se quiere aumentar la constante de error sin moverlos notablemente (Ogata, sec. 7-4).`,
      result: `s = ${rect(dom0)},\\quad ${cName} = ${n(kv0)}`,
    });
    ratio = input.lagBeta;
    zero = input.lagZero;
    pole = zero / ratio;
    const shape: TransferFunction = { num: [1, zero], den: [1, pole] };
    const contribution = C.degrees(C.arg(evalTf(shape, dom0)));
    steps.push({
      title: 'Cero y polo del compensador de atraso',
      explanation: `El cero y el polo van cerca del origen con z/p = β = ${formatNumber(ratio, DIGITS)}: la constante de error crece en un factor de casi β y el compensador aporta solo ${formatNumber(Math.abs(contribution), 3)}° cerca del polo dominante.`,
      formula: 'G_c(s) = \\hat{K}_c\\frac{s + 1/T}{s + 1/(\\beta T)}',
      result: `\\text{cero en } s = ${n(-zero)},\\quad \\text{polo en } s = ${n(-pole)},\\quad \\angle\\frac{s + ${n(zero)}}{s + ${n(pole)}}\\Big|_{s_1} = ${deg(contribution)}`,
    });
    const data = locusData(mulPoly(shape.num, G.num), mulPoly(shape.den, G.den));
    const candidates = dampingPoints(data, zeta);
    const near = candidates.length
      ? candidates.reduce((a, b) => (C.abs(C.sub(b.s, dom0)) < C.abs(C.sub(a.s, dom0)) ? b : a))
      : null;
    if (!near)
      return fail(
        'diseno-imposible',
        'El lugar compensado no corta la recta del mismo ζ cerca de los polos dominantes.',
        steps,
      );
    kc = near.K;
    dominant = near.s;
    steps.push({
      title: 'Nuevos polos dominantes y ganancia',
      explanation: `Sobre el lugar del sistema compensado se ubican los polos con el mismo ζ = ${formatNumber(zeta, 4)}; K̂c sale de la condición de magnitud.`,
      formula: '\\hat{K}_c = \\frac{1}{\\left|\\frac{s_1 + 1/T}{s_1 + 1/(\\beta T)}G(s_1)\\right|}',
      result: `s_1 = ${rect(near.s)},\\quad \\hat{K}_c = ${n(kc)}`,
    });
  } else {
    // Métodos de Bode: K por la constante de error.
    const current = errorConstantOf(G);
    const K = input.errorConstant / current;
    const G1 = { num: G.num.map((c) => c * K), den: G.den };
    reference = G1;
    details.K = K;
    steps.push({
      title: 'Ganancia para la constante de error',
      explanation: `La constante ${cName} de G(s) vale ${formatNumber(current, DIGITS)}: para que valga ${formatNumber(input.errorConstant, DIGITS)} se multiplica por K.`,
      formula: `${cName} = \\lim_{s\\to 0} ${type === 0 ? '' : type === 1 ? 's' : `s^{${type}}`}KG(s)`,
      substitution: `K = \\frac{${n(input.errorConstant)}}{${n(current)}}`,
      result: `K = ${n(K)},\\quad G_1(s) = KG(s) = ${tfTex(G1)}`,
    });
    const form1 = bodeForm(G1);
    const m1 = margins(G1, form1);
    const pm1 = m1.phaseMargin ?? 180;
    details.uncompensatedPhaseMargin = pm1;
    steps.push({
      title: 'Margen de fase sin compensar',
      explanation: `Con la ganancia ajustada, G₁(jω) cruza 0 dB en ω = ${formatNumber(m1.gainCrossover ?? NaN, DIGITS)} rad/s.`,
      result: `\\gamma_1 = ${deg(pm1)}`,
    });
    const [lo, hi] = frequencyRange(form1, [m1.gainCrossover ?? 1]);
    if (input.mode === 'bode-adelanto') {
      const phiM = input.leadPhase ?? input.phaseMargin - pm1 + input.allowance;
      if (phiM <= 0)
        return fail(
          'sin-compensacion',
          'El margen de fase ya es suficiente: no hace falta adelanto.',
          steps,
        );
      if (phiM >= 75)
        return fail(
          'diseno-imposible',
          'Se necesitan más de 75° de adelanto: una sola red de adelanto no basta (Ogata, sec. 9-2).',
          steps,
        );
      const sinPhi = Math.sin(C.radians(phiM));
      ratio = (1 - sinPhi) / (1 + sinPhi);
      details.leadPhase = phiM;
      steps.push({
        title: 'Adelanto de fase máximo y factor de atenuación',
        explanation: input.leadPhase
          ? 'Se usa el adelanto máximo elegido.'
          : `Se agregan ${formatNumber(input.allowance, DIGITS)}° al faltante para compensar el desplazamiento de la frecuencia de cruce hacia la derecha.`,
        formula:
          '\\phi_m = \\gamma_d - \\gamma_1 + \\text{margen},\\qquad \\operatorname{sen}\\phi_m = \\frac{1 - \\alpha}{1 + \\alpha}',
        substitution: input.leadPhase
          ? undefined
          : `\\phi_m = ${deg(input.phaseMargin)} - ${deg(pm1)} + ${deg(input.allowance)}`,
        result: `\\phi_m = ${deg(phiM)},\\quad \\alpha = \\frac{1 - \\operatorname{sen}\\phi_m}{1 + \\operatorname{sen}\\phi_m} = ${n(ratio)}`,
      });
      const target = Math.sqrt(ratio);
      const wc =
        input.crossover ?? solveFrequency((w) => magnitude(G1, w), target, lo / 100, hi * 100);
      if (!wc)
        return fail('diseno-imposible', 'No se encontró la frecuencia donde |G₁(jω)| = √α.', steps);
      details.crossover = wc;
      steps.push({
        title: 'Nueva frecuencia de cruce de ganancia',
        explanation:
          'El compensador sube la magnitud 20 log(1/√α) dB en ω_m = 1/(√α T), donde da el adelanto máximo; se elige ω_m como la frecuencia donde |G₁| vale −20 log(1/√α) dB.',
        formula:
          '|G_1(j\\omega_c)| = \\sqrt{\\alpha} \\iff |G_1|_{\\text{dB}} = -20\\log_{10}\\frac{1}{\\sqrt{\\alpha}}',
        substitution: `-20\\log_{10}\\frac{1}{\\sqrt{${n(ratio)}}} = ${n(20 * Math.log10(target))}\\ \\text{dB}`,
        result: `\\omega_c = ${n(wc)}\\ \\text{rad/s}`,
      });
      zero = Math.sqrt(ratio) * wc;
      pole = wc / Math.sqrt(ratio);
      kc = K / ratio;
      steps.push({
        title: 'Frecuencias de esquina y ganancia del compensador',
        formula:
          '\\frac{1}{T} = \\sqrt{\\alpha}\\,\\omega_c,\\qquad \\frac{1}{\\alpha T} = \\frac{\\omega_c}{\\sqrt{\\alpha}},\\qquad K_c = \\frac{K}{\\alpha}',
        result: `\\frac{1}{T} = ${n(zero)},\\quad \\frac{1}{\\alpha T} = ${n(pole)},\\quad K_c = ${n(kc)}`,
      });
    } else {
      const targetPhase = -180 + input.phaseMargin + input.allowance;
      const wc =
        input.crossover ??
        solveFrequency((w) => phaseDeg(form1, w), targetPhase, lo / 100, hi * 100);
      if (!wc)
        return fail(
          'diseno-imposible',
          `La fase de G₁(jω) nunca vale ${formatNumber(targetPhase, DIGITS)}°.`,
          steps,
        );
      details.crossover = wc;
      steps.push({
        title: 'Nueva frecuencia de cruce de ganancia',
        explanation: `Se busca la frecuencia donde la fase de G₁ es −180° más el margen de fase pedido más ${formatNumber(input.allowance, DIGITS)}° de tolerancia por el atraso que introduce el compensador (Ogata recomienda entre 5° y 12°).`,
        formula: '\\angle G_1(j\\omega_c) = -180^{\\circ} + \\gamma_d + \\text{tolerancia}',
        substitution: `\\angle G_1(j\\omega_c) = ${deg(targetPhase)}`,
        result: `\\omega_c = ${n(wc)}\\ \\text{rad/s}`,
      });
      const mag = magnitude(G1, wc);
      ratio = mag;
      zero = input.zeroFrequency ?? wc / 10;
      pole = zero / ratio;
      kc = K / ratio;
      steps.push({
        title: 'Atenuación y frecuencias de esquina',
        explanation: `Para que la magnitud valga 0 dB en ω_c, el compensador debe atenuar ${formatNumber(20 * Math.log10(mag), DIGITS)} dB = −20 log β. El cero va ${input.zeroFrequency ? 'en la esquina elegida' : 'una década por debajo de ω_c'} y el polo en 1/(βT).`,
        formula:
          '\\beta = |G_1(j\\omega_c)|,\\qquad \\frac{1}{T},\\qquad \\frac{1}{\\beta T},\\qquad K_c = \\frac{K}{\\beta}',
        result: `\\beta = ${n(ratio)},\\quad \\frac{1}{T} = ${n(zero)},\\quad \\frac{1}{\\beta T} = ${n(pole)},\\quad K_c = ${n(kc)}`,
      });
    }
  }

  const compensator = lead(kc, zero, pole);
  const openLoop = tfMul(compensator, G);
  const closedLoop = closedOf(openLoop);
  const closedPoles = polyRoots(closedLoop.den).map((r) => r.value);
  dominant ??= dominantPole(closedPoles);
  const constant = errorConstantOf(openLoop);
  steps.push({
    title: 'Compensador',
    formula: `G_c(s) = K_c\\frac{s + 1/T}{s + 1/(${input.mode.endsWith('adelanto') ? '\\alpha' : '\\beta'} T)}`,
    result: `G_c(s) = ${n(kc)}\\frac{s + ${n(zero)}}{s + ${n(pole)}}`,
  });
  let phaseMargin: number | null = null;
  let gainMarginDb: number | null = null;
  const verification: Step[] = [
    { title: 'Lazo abierto compensado', result: `G_c(s)G(s) = ${tfTex(openLoop)}` },
    { title: 'Polos en lazo cerrado', explanation: rootsText(polyRoots(closedLoop.den)) + '.' },
    { title: `Constante de error`, result: `${cName} = ${n(constant)}` },
  ];
  if (input.mode.startsWith('bode')) {
    const m = margins(openLoop, bodeForm(openLoop));
    phaseMargin = m.phaseMargin;
    gainMarginDb = m.gainMarginDb;
    verification.push({
      title: 'Márgenes del sistema compensado',
      result: `\\gamma = ${phaseMargin === null ? '\\infty' : deg(phaseMargin)},\\quad K_g = ${gainMarginDb === null ? '\\infty' : `${n(gainMarginDb)}\\ \\text{dB}`}`,
    });
    if (phaseMargin !== null && phaseMargin < input.phaseMargin - 0.5) {
      notices.push({
        level: 'warning',
        message: `El margen de fase compensado (${formatNumber(phaseMargin, 4)}°) queda por debajo del pedido: aumenta el margen adicional y repite el diseño.`,
      });
    }
  }
  steps.push({ title: 'Verificación', children: verification });

  // Respuestas al escalón con y sin compensar.
  const series: Series[] = [];
  const stableC = closedPoles.every((r) => r.re < -1e-9);
  const before = closedOf(reference);
  const stableB = polyRoots(before.den).every((r) => r.value.re < -1e-9);
  if (stableC) {
    const after = timeResponse(closedLoop, 'escalon');
    const prev = stableB ? timeResponse(before, 'escalon') : null;
    if (after) {
      const horizon = Math.min(horizonFor(closedLoop, 2), 60);
      series.push({
        id: 'escalon',
        title: 'Respuesta al escalón unitario',
        xLabel: 't (s)',
        yLabel: 'c(t)',
        label: 'Compensado',
        points: sample(after.evaluate, horizon),
        ...(prev
          ? { reference: { label: 'Sin compensar', points: sample(prev.evaluate, horizon) } }
          : {}),
      });
    }
  }

  const summary: SummaryItem[] = [
    {
      label: 'Compensador',
      value: `G_c(s) = ${n(kc)}\\frac{s + ${n(zero)}}{s + ${n(pole)}}`,
      emphasis: true,
    },
    { label: input.mode.endsWith('adelanto') ? 'α' : 'β', value: n(ratio) },
    { label: 'Constante de error', value: `${cName} = ${n(constant)}` },
  ];
  if (phaseMargin !== null)
    summary.push({ label: 'Margen de fase compensado', value: deg(phaseMargin) });
  if (gainMarginDb !== null)
    summary.push({
      label: 'Margen de ganancia compensado',
      value: `${n(gainMarginDb)}\\ \\text{dB}`,
    });
  if (dominant) summary.push({ label: 'Polos dominantes', value: `s = ${rect(dominant)}` });

  return {
    ok: true,
    value: {
      compensator,
      kc,
      zero,
      pole,
      ratio,
      openLoop,
      closedLoop,
      phaseMargin,
      gainMarginDb,
      dominant,
      errorConstant: constant,
      details,
    },
    summary,
    steps,
    tables: [],
    series,
    notices,
  };
}

export const compensadorAdelantoRetraso: Calculator<
  CompensatorInput,
  CompensatorValue,
  CompensatorErrorCode
> = {
  meta: {
    id: 'compensador-adelanto-retraso',
    title: 'Compensador de adelanto o retraso de fase',
    summary: 'Diseño por el lugar de las raíces o por el diagrama de Bode.',
    citations: [
      {
        sourceId: 'ogata-1998',
        locator: 'Sec. 7-3 y 7-4 (ejemplos 7-1 y 7-2) y sec. 9-2 y 9-3 (ejemplos 9-1 y 9-2)',
      },
    ],
  },
  inputSchema,
  // Ogata, ejemplo 9-1: G(s) = 4/[s(s + 2)], K_v = 20, margen de fase de 50°.
  example: {
    mode: 'bode-adelanto',
    plant: '4/(s(s + 2))',
    zeta: 0.5,
    omegaN: 4,
    lagBeta: 10,
    lagZero: 0.05,
    errorConstant: 20,
    phaseMargin: 50,
    allowance: 5,
  },
  solve: solveCompensator,
};
