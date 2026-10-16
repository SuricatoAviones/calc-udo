/**
 * Regulador Zener básico: resistencia serie R_S, diodo Zener y carga R_L (Boylestad, 10.ª ed.,
 * sec. 2.10; Malvino, 6.ª ed., sec. 5-2 y 5-3).
 *
 * Estado: se quita el Zener y se calcula V = R_L·V_i/(R_S + R_L). Si V ≥ V_Z está encendido y
 * V_L = V_Z (o V_Z + I_Z·R_Z con la segunda aproximación); I_Z = I_R − I_L.
 * Intervalos: R_L mín = R_S·V_Z/(V_i − V_Z), I_L mín = I_R − I_ZM (Boylestad, ecs. 2.20 a 2.26);
 * V_i mín = (R_L + R_S)V_Z/R_L, V_i máx = (I_ZM + I_L)R_S + V_Z (ecs. 2.27 a 2.29).
 * Rizado: V_r(out) = (R_Z ∥ R_L)/(R_S + R_Z ∥ R_L)·V_r(in) ≈ (R_Z/R_S)·V_r(in) (Malvino, ec. 5-8).
 */
import { toLatexNumber } from '@/lib/math/format';
import type { Step } from '../types';
import { engTex, engText, parallel } from './units';

const n = (v: number) => toLatexNumber(v, 6);

export interface ZenerFixedResult {
  on: boolean;
  vOpen: number;
  vl: number;
  vr: number;
  il: number;
  ir: number;
  iz: number;
  pz: number;
  steps: Step[];
}

/** V_i, R_S y R_L fijos (Boylestad, ejemplo 2.26). Con R_Z > 0 usa la segunda aproximación. */
export function zenerFixed(
  vi: number,
  rs: number,
  rl: number,
  vz: number,
  rz = 0,
): ZenerFixedResult {
  const steps: Step[] = [];
  const vOpen = (rl * vi) / (rs + rl);
  const on = vOpen >= vz;
  steps.push({
    title: 'Estado del diodo Zener',
    explanation: on
      ? `Sin el Zener, la carga tendría ${engText(vOpen, 'V')} ≥ V_Z = ${engText(vz, 'V')}: el Zener conduce en ruptura y fija la tensión.`
      : `Sin el Zener, la carga tendría ${engText(vOpen, 'V')} < V_Z = ${engText(vz, 'V')}: el Zener está apagado (circuito abierto) y no regula.`,
    formula: 'V = \\frac{R_L V_i}{R_S + R_L}',
    substitution: `V = \\frac{(${n(rl)})(${n(vi)})}{${n(rs)} + ${n(rl)}}`,
    result: `V = ${n(vOpen)}\\ \\text{V}\\ ${on ? '\\ge' : '<'}\\ V_Z`,
  });
  if (!on) {
    const il = vOpen / rl;
    steps.push({
      title: 'Divisor de tensión',
      formula: 'V_L = V,\\qquad I_Z = 0',
      result: `V_L = ${n(vOpen)}\\ \\text{V},\\quad V_R = ${n(vi - vOpen)}\\ \\text{V},\\quad I_L = ${engTex(il, 'A')}`,
    });
    return { on, vOpen, vl: vOpen, vr: vi - vOpen, il, ir: il, iz: 0, pz: 0, steps };
  }
  let vl: number;
  if (rz > 0) {
    // Nodo de la carga: (V_i − V_L)/R_S = (V_L − V_Z)/R_Z + V_L/R_L.
    vl = (vi / rs + vz / rz) / (1 / rs + 1 / rz + 1 / rl);
    steps.push({
      title: 'Tensión en la carga (segunda aproximación)',
      explanation:
        'El Zener se modela como V_Z en serie con su resistencia R_Z: la tensión sube un poco con la corriente.',
      formula: '\\frac{V_i - V_L}{R_S} = \\frac{V_L - V_Z}{R_Z} + \\frac{V_L}{R_L}',
      result: `V_L = ${n(vl)}\\ \\text{V}`,
    });
  } else {
    vl = vz;
    steps.push({
      title: 'Tensión en la carga',
      explanation:
        'El Zener encendido se reemplaza por una fuente de V_Z en paralelo con la carga.',
      formula: 'V_L = V_Z',
      result: `V_L = ${n(vl)}\\ \\text{V}`,
    });
  }
  const vr = vi - vl;
  const ir = vr / rs;
  const il = vl / rl;
  const iz = ir - il;
  const pz = (rz > 0 ? vl : vz) * iz;
  steps.push({
    title: 'Corrientes',
    formula: 'I_R = \\frac{V_i - V_L}{R_S},\\qquad I_L = \\frac{V_L}{R_L},\\qquad I_Z = I_R - I_L',
    substitution: `I_R = \\frac{${n(vi)} - ${n(vl)}}{${n(rs)}},\\quad I_L = \\frac{${n(vl)}}{${n(rl)}}`,
    result: `I_R = ${engTex(ir, 'A')},\\quad I_L = ${engTex(il, 'A')},\\quad I_Z = ${engTex(iz, 'A')}`,
  });
  steps.push({
    title: 'Potencia en el Zener',
    formula: 'P_Z = V_Z I_Z',
    result: `P_Z = ${engTex(pz, 'W')}`,
  });
  return { on, vOpen, vl, vr, il, ir, iz, pz, steps };
}

export interface ZenerLoadRange {
  rlMin: number;
  ilMax: number;
  ir: number;
  ilMin: number;
  rlMax: number;
  pMax: number;
  steps: Step[];
}

/** V_i fija y R_L variable (Boylestad, ejemplo 2.27). */
export function zenerLoadRange(vi: number, rs: number, vz: number, izm: number): ZenerLoadRange {
  const rlMin = (rs * vz) / (vi - vz);
  const ilMax = vz / rlMin;
  const ir = (vi - vz) / rs;
  const ilMin = Math.max(0, ir - izm);
  const rlMax = ilMin > 0 ? vz / ilMin : Infinity;
  const pMax = vz * izm;
  const steps: Step[] = [
    {
      title: 'Resistencia de carga mínima',
      explanation: 'Con una carga muy pequeña la tensión no alcanza V_Z y el Zener se apaga.',
      formula:
        'R_{L\\,min} = \\frac{R_S V_Z}{V_i - V_Z},\\qquad I_{L\\,max} = \\frac{V_Z}{R_{L\\,min}}',
      substitution: `R_{L\\,min} = \\frac{(${n(rs)})(${n(vz)})}{${n(vi)} - ${n(vz)}}`,
      result: `R_{L\\,min} = ${engTex(rlMin, 'Ω')},\\quad I_{L\\,max} = ${engTex(ilMax, 'A')}`,
    },
    {
      title: 'Corriente por R_S',
      explanation: 'Con el Zener encendido, la tensión en R_S es fija y su corriente también.',
      formula: 'I_R = \\frac{V_i - V_Z}{R_S}',
      result: `I_R = ${engTex(ir, 'A')}`,
    },
    {
      title: 'Resistencia de carga máxima',
      explanation:
        'La corriente del Zener no puede superar I_ZM: eso fija la corriente mínima de la carga.',
      formula: 'I_{L\\,min} = I_R - I_{ZM},\\qquad R_{L\\,max} = \\frac{V_Z}{I_{L\\,min}}',
      substitution: `I_{L\\,min} = ${n(ir)} - ${n(izm)}`,
      result: `I_{L\\,min} = ${engTex(ilMin, 'A')},\\quad R_{L\\,max} = ${Number.isFinite(rlMax) ? engTex(rlMax, 'Ω') : '\\infty'}`,
    },
    {
      title: 'Potencia nominal del Zener',
      formula: 'P_{max} = V_Z I_{ZM}',
      result: `P_{max} = ${engTex(pMax, 'W')}`,
    },
  ];
  return { rlMin, ilMax, ir, ilMin, rlMax, pMax, steps };
}

export interface ZenerInputRange {
  viMin: number;
  viMax: number;
  il: number;
  irMax: number;
  steps: Step[];
}

/** R_L fija y V_i variable (Boylestad, ejemplo 2.28). */
export function zenerInputRange(rl: number, rs: number, vz: number, izm: number): ZenerInputRange {
  const viMin = ((rl + rs) * vz) / rl;
  const il = vz / rl;
  const irMax = izm + il;
  const viMax = irMax * rs + vz;
  const steps: Step[] = [
    {
      title: 'Tensión de entrada mínima',
      explanation: 'Es la menor V_i con la que el divisor R_S–R_L alcanza V_Z y el Zener enciende.',
      formula: 'V_{i\\,min} = \\frac{(R_L + R_S)V_Z}{R_L}',
      substitution: `V_{i\\,min} = \\frac{(${n(rl)} + ${n(rs)})(${n(vz)})}{${n(rl)}}`,
      result: `V_{i\\,min} = ${n(viMin)}\\ \\text{V}`,
    },
    {
      title: 'Tensión de entrada máxima',
      explanation: 'I_L es fija (V_Z/R_L); la corriente máxima por R_S es I_ZM + I_L.',
      formula:
        'I_L = \\frac{V_Z}{R_L},\\qquad I_{R\\,max} = I_{ZM} + I_L,\\qquad V_{i\\,max} = I_{R\\,max}R_S + V_Z',
      substitution: `I_{R\\,max} = ${n(izm)} + ${n(il)}`,
      result: `I_L = ${engTex(il, 'A')},\\quad V_{i\\,max} = ${n(viMax)}\\ \\text{V}`,
    },
  ];
  return { viMin, viMax, il, irMax, steps };
}

/**
 * Resistencia serie máxima para que el Zener no salga de ruptura en el peor caso: la menor tensión
 * de fuente con la mayor corriente de carga (Malvino, ecs. 5-9 y 5-10).
 */
export function maxSeriesResistance(
  vsMin: number,
  vz: number,
  rlMin: number,
): { rsMax: number; step: Step } {
  const rsMax = (vsMin / vz - 1) * rlMin;
  return {
    rsMax,
    step: {
      title: 'Punto límite de funcionamiento',
      explanation:
        'En el peor caso (fuente mínima y carga máxima) la corriente del Zener llega a cero. R_S no debe superar este valor para que el regulador funcione en todas las condiciones.',
      formula:
        'R_{S(max)} = \\left(\\frac{V_{S(min)}}{V_Z} - 1\\right)R_{L(min)} = \\frac{V_{S(min)} - V_Z}{I_{L(max)}}',
      substitution: `R_{S(max)} = \\left(\\frac{${n(vsMin)}}{${n(vz)}} - 1\\right)(${n(rlMin)})`,
      result: `R_{S(max)} = ${engTex(rsMax, 'Ω')}`,
    },
  };
}

/** Rizado a la salida del regulador (Malvino, ec. 5-8). */
export function zenerRipple(vrin: number, rs: number, rz: number, rl?: number) {
  const rzl = rl !== undefined ? parallel(rz, rl) : rz;
  const exact = (rzl / (rs + rzl)) * vrin;
  const approx = (rz / rs) * vrin;
  const step: Step = {
    title: 'Rizado a la salida',
    explanation:
      'Para la señal de rizado el Zener es solo su resistencia R_Z: el regulador es un divisor de tensión que lo atenúa.',
    formula:
      'V_{r(out)} = \\frac{R_Z \\parallel R_L}{R_S + R_Z \\parallel R_L}V_{r(in)} \\approx \\frac{R_Z}{R_S}V_{r(in)}',
    substitution: `V_{r(out)} \\approx \\frac{${n(rz)}}{${n(rs)}}(${n(vrin)})`,
    result: `V_{r(out)} \\approx ${engTex(approx, 'V')}\\quad(\\text{exacto: }${engTex(exact, 'V')})`,
  };
  return { exact, approx, step };
}
