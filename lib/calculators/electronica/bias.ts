/**
 * Polarización de cd de transistores (canal n / NPN), con las ecuaciones de Boylestad y
 * Nashelsky, 10.ª ed. en español, caps. 4 y 7.
 *
 * BJT:
 *   Fija:            I_B = (V_CC − V_BE)/R_B,                      V_CE = V_CC − I_C R_C
 *   Emisor:          I_B = (V_CC − V_BE)/[R_B + (β + 1)R_E],       V_CE = V_CC − I_C(R_C + R_E)
 *   Divisor exacto:  R_Th = R₁∥R₂, E_Th = R₂V_CC/(R₁ + R₂), I_B = (E_Th − V_BE)/[R_Th + (β + 1)R_E]
 *   Divisor aprox.:  V_B = E_Th, V_E = V_B − V_BE, I_C ≈ I_E = V_E/R_E (si βR_E ≥ 10R₂)
 *   Realim. colector: I_B = (V_CC − V_BE)/[R_F + β(R_C + R_E)]
 * FET:
 *   JFET y MOSFET de empobrecimiento: I_D = I_DSS(1 − V_GS/V_P)² con la recta de polarización
 *     V_GS = V_G − I_D R_S (fija: V_GS = −V_GG).
 *   MOSFET de enriquecimiento: I_D = k(V_GS − V_GS(Th))², k = I_D(enc)/(V_GS(enc) − V_GS(Th))²,
 *     con V_GS = V_DD − I_D R_D (realimentación) o V_GS = V_G − I_D R_S (divisor).
 * El punto Q de los FET se obtiene resolviendo la ecuación de segundo grado (el método matemático
 * del libro, que también lo resuelve gráficamente).
 */
import { toLatexNumber } from '@/lib/math/format';
import type { Step } from '../types';
import { engTex, engText, parallel } from './units';

const n = (v: number, d = 6) => toLatexNumber(v, d);

export type BjtConfig = 'fija' | 'emisor' | 'divisor' | 'realimentacion';

export interface BjtParams {
  config: BjtConfig;
  method: 'exacto' | 'aproximado';
  vcc: number;
  rb: number;
  r1: number;
  r2: number;
  rc: number;
  re: number;
  beta: number;
  vbe: number;
}

export interface BjtResult {
  ib: number;
  ic: number;
  ie: number;
  vce: number;
  vb: number;
  vc: number;
  ve: number;
  /** V_BC = V_B − V_C: negativa con la unión base-colector en inversa (región activa). */
  vbc: number;
  icSat: number;
  region: 'activa' | 'saturacion' | 'corte';
  approxValid?: boolean;
  steps: Step[];
}

export function bjtBias(p: BjtParams): BjtResult {
  const { vcc, rb, r1, r2, rc, beta, vbe } = p;
  const re = p.config === 'fija' ? 0 : p.re;
  const steps: Step[] = [];
  let ib: number;
  let ic = 0;
  let ie = 0;
  let approxValid: boolean | undefined;

  if (p.config === 'fija') {
    ib = (vcc - vbe) / rb;
    steps.push({
      title: 'Corriente de base (malla base-emisor)',
      formula: 'I_B = \\frac{V_{CC} - V_{BE}}{R_B}',
      substitution: `I_B = \\frac{${n(vcc)} - ${n(vbe)}}{${n(rb)}}`,
      result: `I_B = ${engTex(ib, 'A')}`,
    });
  } else if (p.config === 'emisor') {
    ib = (vcc - vbe) / (rb + (beta + 1) * re);
    steps.push({
      title: 'Corriente de base (malla base-emisor)',
      explanation: 'R_E se refleja en la base multiplicada por (β + 1).',
      formula: 'I_B = \\frac{V_{CC} - V_{BE}}{R_B + (\\beta + 1)R_E}',
      substitution: `I_B = \\frac{${n(vcc)} - ${n(vbe)}}{${n(rb)} + (${n(beta + 1)})(${n(re)})}`,
      result: `I_B = ${engTex(ib, 'A')}`,
    });
  } else if (p.config === 'realimentacion') {
    ib = (vcc - vbe) / (rb + beta * (rc + re));
    steps.push({
      title: 'Corriente de base (malla base-emisor)',
      explanation:
        'R_F va del colector a la base: la corriente de colector pasa por R_C y por R_E (I_C′ ≈ I_C).',
      formula: 'I_B = \\frac{V_{CC} - V_{BE}}{R_F + \\beta(R_C + R_E)}',
      substitution: `I_B = \\frac{${n(vcc)} - ${n(vbe)}}{${n(rb)} + ${n(beta)}(${n(rc)} + ${n(re)})}`,
      result: `I_B = ${engTex(ib, 'A')}`,
    });
  } else {
    const rth = parallel(r1, r2);
    const eth = (r2 * vcc) / (r1 + r2);
    approxValid = beta * re >= 10 * r2;
    steps.push({
      title: 'Condición para el análisis aproximado',
      explanation: approxValid
        ? 'βR_E ≥ 10R₂: la corriente de base es pequeña frente a la del divisor y el análisis aproximado es válido.'
        : 'βR_E < 10R₂: la corriente de base no es despreciable; conviene el análisis exacto.',
      formula: '\\beta R_E \\ge 10R_2',
      substitution: `(${n(beta)})(${n(re)}) ${approxValid ? '\\ge' : '<'} 10(${n(r2)})`,
      result: `${engTex(beta * re, 'Ω')}\\ ${approxValid ? '\\ge' : '<'}\\ ${engTex(10 * r2, 'Ω')}`,
    });
    if (p.method === 'exacto') {
      ib = (eth - vbe) / (rth + (beta + 1) * re);
      steps.push({
        title: 'Equivalente de Thévenin de la base',
        formula: 'R_{Th} = R_1 \\parallel R_2,\\qquad E_{Th} = \\frac{R_2 V_{CC}}{R_1 + R_2}',
        substitution: `E_{Th} = \\frac{(${n(r2)})(${n(vcc)})}{${n(r1)} + ${n(r2)}}`,
        result: `R_{Th} = ${engTex(rth, 'Ω')},\\quad E_{Th} = ${n(eth)}\\ \\text{V}`,
      });
      steps.push({
        title: 'Corriente de base',
        formula: 'I_B = \\frac{E_{Th} - V_{BE}}{R_{Th} + (\\beta + 1)R_E}',
        substitution: `I_B = \\frac{${n(eth)} - ${n(vbe)}}{${n(rth)} + (${n(beta + 1)})(${n(re)})}`,
        result: `I_B = ${engTex(ib, 'A')}`,
      });
    } else {
      const vb = eth;
      const ve = vb - vbe;
      ie = ve / re;
      ic = ie;
      ib = ic / beta;
      steps.push({
        title: 'Tensión de base (divisor sin carga)',
        formula: 'V_B = \\frac{R_2 V_{CC}}{R_1 + R_2},\\qquad V_E = V_B - V_{BE}',
        substitution: `V_B = \\frac{(${n(r2)})(${n(vcc)})}{${n(r1)} + ${n(r2)}}`,
        result: `V_B = ${n(vb)}\\ \\text{V},\\quad V_E = ${n(ve)}\\ \\text{V}`,
      });
      steps.push({
        title: 'Corriente de emisor',
        formula: 'I_C \\approx I_E = \\frac{V_E}{R_E}',
        substitution: `I_E = \\frac{${n(ve)}}{${n(re)}}`,
        result: `I_C \\approx I_E = ${engTex(ie, 'A')}`,
      });
    }
  }

  if (!(p.config === 'divisor' && p.method === 'aproximado')) {
    ic = beta * ib;
    ie = (beta + 1) * ib;
    steps.push({
      title: 'Corriente de colector',
      formula: 'I_C = \\beta I_B,\\qquad I_E = (\\beta + 1)I_B',
      substitution: `I_C = (${n(beta)})(${n(ib)})`,
      result: `I_C = ${engTex(ic, 'A')},\\quad I_E = ${engTex(ie, 'A')}`,
    });
  }

  const icSat = vcc / (rc + re);
  let region: BjtResult['region'] = 'activa';
  if (ib <= 0) region = 'corte';
  else if (ic >= icSat) region = 'saturacion';
  if (region !== 'activa') {
    if (region === 'corte') {
      ib = 0;
      ic = 0;
      ie = 0;
    } else {
      ic = icSat;
      ie = icSat;
    }
  }

  const vce = region === 'saturacion' ? 0 : vcc - ic * (rc + re);
  const vc = vcc - ic * rc;
  const ve = ic * re;
  const vb = region === 'corte' ? 0 : ve + vbe;
  steps.push({
    title: 'Tensión colector-emisor (malla colector-emisor)',
    explanation: re > 0 ? 'Se toma I_E ≈ I_C en la malla de salida, como en el libro.' : undefined,
    formula: re > 0 ? 'V_{CE} = V_{CC} - I_C(R_C + R_E)' : 'V_{CE} = V_{CC} - I_C R_C',
    substitution:
      re > 0
        ? `V_{CE} = ${n(vcc)} - (${n(ic)})(${n(rc)} + ${n(re)})`
        : `V_{CE} = ${n(vcc)} - (${n(ic)})(${n(rc)})`,
    result: `V_{CE} = ${n(vce)}\\ \\text{V}`,
  });
  steps.push({
    title: 'Tensiones de los terminales y región de trabajo',
    explanation:
      region === 'activa'
        ? `I_C (${engText(ic, 'A')}) es menor que la de saturación (${engText(icSat, 'A')}): el transistor está en la región activa.`
        : region === 'saturacion'
          ? 'La corriente calculada supera la de saturación: el transistor está saturado (V_CE ≈ 0).'
          : 'La base no recibe corriente: el transistor está en corte.',
    formula:
      'V_C = V_{CC} - I_C R_C,\\quad V_E = I_E R_E \\approx I_C R_E,\\quad V_B = V_E + V_{BE},\\quad I_{C(sat)} = \\frac{V_{CC}}{R_C + R_E}',
    result: `V_C = ${n(vc)}\\ \\text{V},\\ V_E = ${n(ve)}\\ \\text{V},\\ V_B = ${n(vb)}\\ \\text{V},\\ I_{C(sat)} = ${engTex(icSat, 'A')}`,
  });

  return { ib, ic, ie, vce, vb, vc, ve, vbc: vb - vc, icSat, region, approxValid, steps };
}

// ─── FET ────────────────────────────────────────────────────────────────────

export interface FetQuadratic {
  vgs: number;
  id: number;
  roots: number[];
  step: Step;
}

/**
 * Raíz válida de V_GS = V₀ − R·I_D(V_GS) con I_D = K(V_GS − V_x)² (Shockley con K = I_DSS/V_P² y
 * V_x = V_P, o enriquecimiento con K = k y V_x = V_GS(Th)). La raíz válida es la que queda del lado
 * de conducción: V_GS > V_x.
 */
export function solveFetBias(
  v0: number,
  r: number,
  k: number,
  vx: number,
  label: string,
): FetQuadratic | null {
  if (r === 0) {
    const vgs = v0;
    const id = vgs > vx ? k * (vgs - vx) ** 2 : 0;
    return {
      vgs,
      id,
      roots: [vgs],
      step: {
        title: 'Punto de operación',
        explanation:
          'V_GS queda fijo por la red: basta sustituirlo en la ecuación del dispositivo.',
        result: `V_{GSQ} = ${n(vgs)}\\ \\text{V},\\quad I_{DQ} = ${engTex(id, 'A')}`,
      },
    };
  }
  // r·k·u² + (1 − 2r·k·vx)·u + (r·k·vx² − v0) = 0
  const a = r * k;
  const b = 1 - 2 * r * k * vx;
  const c = r * k * vx * vx - v0;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return null;
  const roots = [(-b + Math.sqrt(disc)) / (2 * a), (-b - Math.sqrt(disc)) / (2 * a)];
  const valid = roots.filter((u) => u >= vx - 1e-12).sort((x, y) => x - y);
  if (valid.length === 0) return null;
  const vgs = valid[0]!;
  const id = (v0 - vgs) / r;
  return {
    vgs,
    id,
    roots,
    step: {
      title: 'Intersección: ecuación de segundo grado',
      explanation: `Se sustituye la recta de polarización en la ecuación del dispositivo y se despeja V_GS. De las dos raíces vale la que deja al ${label} conduciendo (V_GS > ${n(vx, 4)} V).`,
      formula:
        'a\\,V_{GS}^{2} + b\\,V_{GS} + c = 0,\\qquad V_{GS} = \\frac{-b \\pm \\sqrt{b^{2} - 4ac}}{2a}',
      substitution: `a = ${n(a)},\\ b = ${n(b)},\\ c = ${n(c)}`,
      result: `V_{GS} = ${n(roots[0]!)}\\ \\text{V}\\ \\text{o}\\ ${n(roots[1]!)}\\ \\text{V}\\ \\Rightarrow\\ V_{GSQ} = ${n(vgs)}\\ \\text{V},\\quad I_{DQ} = ${engTex(id, 'A')}`,
    },
  };
}
