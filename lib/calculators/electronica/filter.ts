/**
 * Filtro con condensador a la entrada (Malvino, 6.ª ed., sec. 4-6; Boylestad, 10.ª ed., sec. 15.3).
 *
 *   V_r(pp) = I/(f_r·C)        f_r = f (media onda) o 2f (onda completa)      (Malvino, ec. 4-10)
 *   V_r(rms) = V_r(pp)/(2√3) = I_cd/(4√3·f·C) en onda completa                (Boylestad, ec. 15.9)
 *   V_cd = V_m − V_r(pp)/2 = V_m − I_cd/(4f·C) en onda completa              (Boylestad, ec. 15.10)
 *
 * Con una resistencia de carga se toma la primera aproximación de Malvino: I ≈ V_m/R_L.
 */
import { toLatexNumber } from '@/lib/math/format';
import type { Step } from '../types';
import { engTex } from './units';

const n = (v: number) => toLatexNumber(v, 6);

export interface FilterInput {
  vm: number;
  fullWave: boolean;
  f: number;
  c: number;
  /** Corriente de carga conocida o resistencia de carga. */
  load: { kind: 'corriente'; idc: number } | { kind: 'resistencia'; rl: number };
}

export interface FilterResult {
  fr: number;
  idc: number;
  vrpp: number;
  vrrms: number;
  vdc: number;
  vmin: number;
  ripple: number;
  steps: Step[];
}

export function capacitorFilter(input: FilterInput): FilterResult {
  const { vm, fullWave, f, c } = input;
  const fr = fullWave ? 2 * f : f;
  const steps: Step[] = [];
  let idc: number;
  if (input.load.kind === 'corriente') {
    idc = input.load.idc;
    steps.push({ title: 'Corriente de carga', result: `I_{cd} = ${engTex(idc, 'A')}` });
  } else {
    idc = vm / input.load.rl;
    steps.push({
      title: 'Corriente de carga (primera aproximación)',
      explanation:
        'Si el rizado es pequeño, la tensión en la carga es casi el pico del rectificador (Malvino, sec. 4-6).',
      formula: 'I \\approx \\frac{V_m}{R_L}',
      substitution: `I \\approx \\frac{${n(vm)}}{${n(input.load.rl)}}`,
      result: `I \\approx ${engTex(idc, 'A')}`,
    });
  }
  const vrpp = idc / (fr * c);
  const vrrms = vrpp / (2 * Math.sqrt(3));
  const vdc = vm - vrpp / 2;
  const vmin = vm - vrpp;
  const ripple = vrrms / vdc;
  steps.push({
    title: 'Rizado pico a pico',
    explanation: `El condensador se descarga entre picos durante 1/f_r. Con ${fullWave ? 'onda completa hay dos picos por ciclo' : 'media onda hay un pico por ciclo'}: f_r = ${n(fr)} Hz.`,
    formula: 'V_{r(pp)} = \\frac{I}{f_r\\,C}',
    substitution: `V_{r(pp)} = \\frac{${n(idc)}}{(${n(fr)})(${n(c)})}`,
    result: `V_{r(pp)} = ${n(vrpp)}\\ \\text{V}`,
  });
  steps.push({
    title: 'Rizado eficaz',
    explanation:
      'El rizado del filtro es casi una onda triangular: su valor eficaz es el pico a pico entre 2√3.',
    formula: fullWave
      ? 'V_{r(rms)} = \\frac{V_{r(pp)}}{2\\sqrt{3}} = \\frac{I_{cd}}{4\\sqrt{3}\\,f\\,C}'
      : 'V_{r(rms)} = \\frac{V_{r(pp)}}{2\\sqrt{3}} = \\frac{I_{cd}}{2\\sqrt{3}\\,f\\,C}',
    result: `V_{r(rms)} = ${n(vrrms)}\\ \\text{V}`,
  });
  steps.push({
    title: 'Tensión de cd y factor de rizo',
    formula: 'V_{cd} = V_m - \\frac{V_{r(pp)}}{2},\\qquad r = \\frac{V_{r(rms)}}{V_{cd}}',
    substitution: `V_{cd} = ${n(vm)} - \\frac{${n(vrpp)}}{2}`,
    result: `V_{cd} = ${n(vdc)}\\ \\text{V},\\quad r = ${n(100 * ripple)}\\,\\%`,
  });
  return { fr, idc, vrpp, vrrms, vdc, vmin, ripple, steps };
}
