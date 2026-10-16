/**
 * Análisis de ca de pequeña señal de amplificadores con BJT (Boylestad y Nashelsky, 10.ª ed. en
 * español, cap. 5).
 *
 * Modelo híbrido aproximado (sec. 5.20; con el modelo r_e basta tomar h_ie = βr_e y h_fe = β):
 *   Emisor común:            Z_i = R′ ∥ h_ie,  Z_o = R_C ∥ 1/h_oe,  A_v = −h_fe(R_C ∥ 1/h_oe)/h_ie
 *   Emisor sin puentear:     Z_b = h_ie + (1 + h_fe)R_E,  Z_i = R′ ∥ Z_b,  A_v = −h_fe R_C/Z_b
 *   Seguidor de emisor:      Z_b = h_ie + (1 + h_fe)R_E,  Z_o = R_E ∥ h_ie/(1 + h_fe),
 *                            A_v = R_E/(R_E + h_ie/(1 + h_fe))
 *   Base común:              Z_i = R_E ∥ h_ib,  Z_o = R_C,  A_v = −h_fb R_C/h_ib
 * con A_i = −A_v·Z_i/R_L (ecs. 5.147 y 5.153) y, con carga y fuente (sec. 5.13), R_C → R_C ∥ R_L
 * y A_vs = Z_i/(Z_i + R_s)·A_vL.
 *
 * Modelo híbrido completo (sec. 5.21, ecs. 5.158 a 5.161), para el transistor como bipuerto:
 *   A_i = h_f/(1 + h_o R_L),  A_v = −h_f R_L/(h_i + (h_i h_o − h_f h_r)R_L),
 *   Z_i = h_i − h_f h_r R_L/(1 + h_o R_L),  Z_o = 1/(h_o − h_f h_r/(h_i + R_s)).
 * Los parámetros en base común se obtienen de los de emisor común con las ecuaciones aproximadas
 * del apéndice A (como en el ejemplo 5.23).
 */
import { toLatexNumber } from '@/lib/math/format';
import type { Step } from '../types';
import { engTex, engText, parallel } from './units';

const n = (v: number, d = 6) => toLatexNumber(v, d);
const ohm = (v: number) => (Number.isFinite(v) ? engTex(v, 'Ω') : '\\infty');

export type AcConfig = 'emisor-comun' | 'emisor-sin-puentear' | 'seguidor' | 'base-comun';

export interface HybridParams {
  hi: number;
  hr: number;
  hf: number;
  ho: number;
}

/** Parámetros en base común a partir de los de emisor común (apéndice A, ecuaciones aproximadas). */
export function commonBaseFromCE(h: HybridParams): { params: HybridParams; step: Step } {
  const k = 1 + h.hf;
  const params: HybridParams = {
    hi: h.hi / k,
    hr: (h.hi * h.ho) / k - h.hr,
    hf: -h.hf / k,
    ho: h.ho / k,
  };
  return {
    params,
    step: {
      title: 'Parámetros en base común',
      explanation:
        'Las hojas de datos dan los parámetros en emisor común; se convierten con las ecuaciones aproximadas del apéndice A.',
      formula:
        'h_{ib} \\approx \\frac{h_{ie}}{1 + h_{fe}},\\quad h_{rb} \\approx \\frac{h_{ie}h_{oe}}{1 + h_{fe}} - h_{re},\\quad h_{fb} \\approx \\frac{-h_{fe}}{1 + h_{fe}},\\quad h_{ob} \\approx \\frac{h_{oe}}{1 + h_{fe}}',
      substitution: `h_{ib} \\approx \\frac{${n(h.hi)}}{1 + ${n(h.hf)}}`,
      result: `h_{ib} = ${ohm(params.hi)},\\ h_{rb} = ${n(params.hr, 4)},\\ h_{fb} = ${n(params.hf, 5)},\\ h_{ob} = ${engTex(params.ho, 'S')}`,
    },
  };
}

export interface AcNetwork {
  config: AcConfig;
  /** Parámetros en emisor común (h_oe = 0: r_o infinita). */
  h: HybridParams;
  /** Resistencia de polarización vista desde la entrada: R_B, R₁ ∥ R₂ o, en base común, R_E. */
  rin: number;
  /** Nombre de rin en las fórmulas: 'R_B', "R'" o 'R_E'. */
  rinTex: string;
  rc: number;
  /** R_E sin puentear (emisor sin puentear y seguidor). */
  re: number;
  rl?: number;
  rs?: number;
}

export interface AcResult {
  zi: number;
  zo: number;
  /** Ganancia de voltaje sin carga externa. */
  avNL: number;
  /** Ganancia de voltaje con la carga R_L (igual a avNL si no hay carga). */
  av: number;
  avs?: number;
  ai: number;
  zb?: number;
  /** Impedancias del transistor solo (modelo completo). */
  ziT?: number;
  zoT?: number;
  aiT?: number;
  /** Parámetros usados (convertidos en base común). */
  params: HybridParams;
  steps: Step[];
}

function loadSteps(
  net: AcNetwork,
  r: { zi: number; zo: number; av: number; avNL: number },
  steps: Step[],
) {
  let avs: number | undefined;
  if (net.rs !== undefined) {
    avs = (r.zi / (r.zi + net.rs)) * r.av;
    steps.push({
      title: 'Ganancia desde la fuente',
      explanation:
        'La resistencia de la fuente y Z_i forman un divisor de voltaje a la entrada (Boylestad, sec. 5.13).',
      formula: 'A_{v_s} = \\frac{V_o}{V_s} = \\frac{Z_i}{Z_i + R_s}A_{v}',
      substitution: `A_{v_s} = \\frac{${n(r.zi)}}{${n(r.zi)} + ${n(net.rs)}}(${n(r.av)})`,
      result: `A_{v_s} = ${n(avs)}`,
    });
  }
  return avs;
}

/** Modelo híbrido aproximado (sec. 5.20) con el efecto de R_L y R_s (sec. 5.13). */
export function approxAmplifier(net: AcNetwork): AcResult {
  const { config, h, rin, rinTex, rc, re, rl } = net;
  const steps: Step[] = [];
  const ro = h.ho > 0 ? 1 / h.ho : Infinity;
  let zi: number;
  let zo: number;
  let avNL: number;
  let av: number;
  let zb: number | undefined;
  let params = h;
  let rOut: number;

  if (config === 'emisor-comun') {
    zi = parallel(rin, h.hi);
    zo = parallel(rc, ro);
    const rac = rl !== undefined ? parallel(rc, ro, rl) : zo;
    avNL = (-h.hf * zo) / h.hi;
    av = (-h.hf * rac) / h.hi;
    rOut = rl ?? rc;
    steps.push({
      title: 'Impedancia de entrada',
      explanation:
        'Con R_E puenteada por C_E, la base ve h_ie en paralelo con la red de polarización.',
      formula: `Z_i = ${rinTex} \\parallel h_{ie}`,
      substitution: `Z_i = ${n(rin)} \\parallel ${n(h.hi)}`,
      result: `Z_i = ${ohm(zi)}`,
    });
    steps.push({
      title: 'Impedancia de salida',
      explanation: Number.isFinite(ro)
        ? 'Se apaga V_i: la fuente h_fe·I_b se abre y quedan 1/h_oe y R_C en paralelo.'
        : 'Sin h_oe (r_o infinita) la salida es solo R_C.',
      formula: 'Z_o = R_C \\parallel \\frac{1}{h_{oe}}',
      substitution: `Z_o = ${n(rc)} \\parallel ${Number.isFinite(ro) ? n(ro) : '\\infty'}`,
      result: `Z_o = ${ohm(zo)}`,
    });
    steps.push({
      title: 'Ganancia de voltaje',
      explanation:
        rl !== undefined
          ? 'V_o = −h_fe·I_b·(R_C ∥ 1/h_oe ∥ R_L) e I_b = V_i/h_ie.'
          : 'V_o = −h_fe·I_b·(R_C ∥ 1/h_oe) e I_b = V_i/h_ie. El signo negativo indica un desfase de 180°.',
      formula:
        rl !== undefined
          ? 'A_v = -\\frac{h_{fe}\\,(R_C \\parallel 1/h_{oe} \\parallel R_L)}{h_{ie}}'
          : 'A_v = -\\frac{h_{fe}\\,(R_C \\parallel 1/h_{oe})}{h_{ie}}',
      substitution: `A_v = -\\frac{(${n(h.hf)})(${n(rac)})}{${n(h.hi)}}`,
      result: `A_v = ${n(av)}`,
    });
  } else if (config === 'emisor-sin-puentear' || config === 'seguidor') {
    const reac = config === 'seguidor' && rl !== undefined ? parallel(re, rl) : re;
    zb = h.hi + (1 + h.hf) * reac;
    zi = parallel(rin, zb);
    steps.push({
      title: 'Impedancia vista desde la base',
      explanation: `R_E${config === 'seguidor' && rl !== undefined ? ' ∥ R_L' : ''} queda en el emisor sin puentear: se refleja en la base multiplicada por (1 + h_fe). El libro suele aproximarla a h_fe·R_E.`,
      formula:
        config === 'seguidor' && rl !== undefined
          ? 'Z_b = h_{ie} + (1 + h_{fe})(R_E \\parallel R_L)'
          : 'Z_b = h_{ie} + (1 + h_{fe})R_E',
      substitution: `Z_b = ${n(h.hi)} + (${n(1 + h.hf)})(${n(reac)})`,
      result: `Z_b = ${ohm(zb)}`,
    });
    steps.push({
      title: 'Impedancia de entrada',
      formula: `Z_i = ${rinTex} \\parallel Z_b`,
      substitution: `Z_i = ${n(rin)} \\parallel ${n(zb)}`,
      result: `Z_i = ${ohm(zi)}`,
    });
    if (config === 'emisor-sin-puentear') {
      zo = rc;
      const rac = rl !== undefined ? parallel(rc, rl) : rc;
      avNL = (-h.hf * rc) / zb;
      av = (-h.hf * rac) / zb;
      rOut = rl ?? rc;
      steps.push({
        title: 'Impedancia de salida',
        explanation:
          'Se ignora r_o (Boylestad lo justifica cuando r_o ≥ 10(R_C + R_E)): la salida es R_C.',
        formula: 'Z_o \\approx R_C',
        result: `Z_o = ${ohm(zo)}`,
      });
      steps.push({
        title: 'Ganancia de voltaje',
        explanation:
          'I_b = V_i/Z_b y V_o = −h_fe·I_b·R_C. Si h_fe·R_E domina Z_b, A_v ≈ −R_C/R_E: casi no depende del transistor.',
        formula:
          rl !== undefined
            ? 'A_v = -\\frac{h_{fe}\\,(R_C \\parallel R_L)}{Z_b}'
            : 'A_v = -\\frac{h_{fe}R_C}{Z_b} \\approx -\\frac{R_C}{R_E}',
        substitution: `A_v = -\\frac{(${n(h.hf)})(${n(rac)})}{${n(zb)}}`,
        result: `A_v = ${n(av)}`,
      });
    } else {
      const rIntr = h.hi / (1 + h.hf);
      zo = parallel(re, rIntr);
      avNL = re / (re + rIntr);
      av = reac / (reac + rIntr);
      rOut = rl ?? re;
      steps.push({
        title: 'Impedancia de salida',
        explanation:
          'Vista desde el emisor, la resistencia de la base se divide entre (1 + h_fe): queda h_ie/(1 + h_fe) ≈ r_e en paralelo con R_E.',
        formula: 'Z_o = R_E \\parallel \\frac{h_{ie}}{1 + h_{fe}}',
        substitution: `Z_o = ${n(re)} \\parallel ${n(rIntr)}`,
        result: `Z_o = ${ohm(zo)}`,
      });
      steps.push({
        title: 'Ganancia de voltaje',
        explanation:
          'Divisor de voltaje entre la resistencia de la salida y la del emisor: A_v es positiva y un poco menor que 1.',
        formula:
          rl !== undefined
            ? 'A_v = \\frac{R_E \\parallel R_L}{R_E \\parallel R_L + h_{ie}/(1 + h_{fe})}'
            : 'A_v = \\frac{R_E}{R_E + h_{ie}/(1 + h_{fe})}',
        substitution: `A_v = \\frac{${n(reac)}}{${n(reac)} + ${n(rIntr)}}`,
        result: `A_v = ${n(av)}`,
      });
    }
  } else {
    const cb = commonBaseFromCE(h);
    params = cb.params;
    steps.push(cb.step);
    const rob = params.ho > 0 ? 1 / params.ho : Infinity;
    zi = parallel(rin, params.hi);
    zo = parallel(rc, rob);
    const rac = rl !== undefined ? parallel(rc, rob, rl) : zo;
    avNL = (-params.hf * zo) / params.hi;
    av = (-params.hf * rac) / params.hi;
    rOut = rl ?? rc;
    steps.push({
      title: 'Impedancia de entrada',
      explanation:
        'La señal entra por el emisor: R_E queda en paralelo con h_ib (≈ r_e), que es muy pequeña.',
      formula: 'Z_i = R_E \\parallel h_{ib}',
      substitution: `Z_i = ${n(rin)} \\parallel ${n(params.hi)}`,
      result: `Z_i = ${ohm(zi)}`,
    });
    steps.push({
      title: 'Impedancia de salida',
      formula: 'Z_o = R_C \\parallel \\frac{1}{h_{ob}} \\approx R_C',
      result: `Z_o = ${ohm(zo)}`,
    });
    steps.push({
      title: 'Ganancia de voltaje',
      explanation:
        'I_e = V_i/h_ib y V_o = −h_fb·I_e·R_C. Como h_fb ≈ −1, la ganancia es positiva (sin desfase).',
      formula:
        rl !== undefined
          ? 'A_v = -\\frac{h_{fb}\\,(R_C \\parallel R_L)}{h_{ib}}'
          : 'A_v = -\\frac{h_{fb}R_C}{h_{ib}}',
      substitution: `A_v = -\\frac{(${n(params.hf)})(${n(rac)})}{${n(params.hi)}}`,
      result: `A_v = ${n(av)}`,
    });
  }

  if (rl !== undefined && config !== 'seguidor') {
    steps.push({
      title: 'Efecto de la carga',
      explanation:
        'La carga queda en paralelo con la salida y reduce la ganancia (Boylestad, sec. 5.13).',
      formula: 'A_{v_L} = \\frac{R_L}{R_L + Z_o}A_{v_{NL}}',
      substitution: `A_{v_L} = \\frac{${n(rl)}}{${n(rl)} + ${n(zo)}}(${n(avNL)})`,
      result: `A_{v_L} = ${n(av)}`,
    });
  }
  const ai = (-av * zi) / rOut;
  steps.push({
    title: 'Ganancia de corriente',
    explanation: `Con I_o la corriente en ${rl !== undefined ? 'R_L' : config === 'seguidor' ? 'R_E' : 'R_C'}, A_i se obtiene de A_v (ecs. 5.147 y 5.153).`,
    formula: `A_i = \\frac{I_o}{I_i} = -A_v\\frac{Z_i}{${rl !== undefined ? 'R_L' : config === 'seguidor' ? 'R_E' : 'R_C'}}`,
    substitution: `A_i = -(${n(av)})\\frac{${n(zi)}}{${n(rOut)}}`,
    result: `A_i = ${n(ai)}`,
  });
  const avs = loadSteps(net, { zi, zo, av, avNL }, steps);
  return { zi, zo, avNL, av, avs, ai, zb, params, steps };
}

/** Modelo híbrido completo (sec. 5.21) en emisor común o base común. */
export function completeAmplifier(net: AcNetwork): AcResult {
  const { config, rin, rinTex, rc, rl } = net;
  const steps: Step[] = [];
  let h = net.h;
  const sub = config === 'base-comun' ? 'b' : 'e';
  if (config === 'base-comun') {
    const cb = commonBaseFromCE(h);
    h = cb.params;
    steps.push(cb.step);
  }
  const rac = rl !== undefined ? parallel(rc, rl) : rc;
  const rsTh = net.rs !== undefined ? parallel(net.rs, rin) : 0;
  const hi = `h_{i${sub}}`;
  const hr = `h_{r${sub}}`;
  const hf = `h_{f${sub}}`;
  const ho = `h_{o${sub}}`;

  const gain = (r: number) => (-h.hf * r) / (h.hi + (h.hi * h.ho - h.hf * h.hr) * r);
  const aiT = h.hf / (1 + h.ho * rac);
  const ziT = h.hi - (h.hf * h.hr * rac) / (1 + h.ho * rac);
  const av = gain(rac);
  const avNL = gain(rc);
  const yo = h.ho - (h.hf * h.hr) / (h.hi + rsTh);
  const zoT = yo > 0 ? 1 / yo : Infinity;
  const zi = parallel(rin, ziT);
  const zo = parallel(rc, zoT);
  const ai = aiT * (rin / (rin + ziT));

  steps.push({
    title: 'Carga del transistor',
    explanation: `El modelo completo trata al transistor como un bipuerto cargado con R_L = ${rl !== undefined ? 'R_C ∥ R_L' : 'R_C'} (capacitores en cortocircuito para la señal).`,
    formula: rl !== undefined ? 'R_L^{\\prime} = R_C \\parallel R_L' : 'R_L^{\\prime} = R_C',
    result: `R_L^{\\prime} = ${ohm(rac)}`,
  });
  steps.push({
    title: 'Ganancia de corriente del transistor',
    formula: `A_i^{\\prime} = \\frac{${hf}}{1 + ${ho}R_L^{\\prime}}`,
    substitution: `A_i^{\\prime} = \\frac{${n(h.hf)}}{1 + (${n(h.ho)})(${n(rac)})}`,
    result: `A_i^{\\prime} = ${n(aiT)}\\quad(\\text{aproximado: } ${n(h.hf)})`,
  });
  steps.push({
    title: 'Ganancia de voltaje',
    explanation:
      'h_r realimenta parte de la salida a la entrada y h_o carga la salida; si (h_i h_o − h_f h_r)R_L′ es pequeño frente a h_i, vuelve la forma aproximada −h_f R_L′/h_i.',
    formula: `A_v = \\frac{-${hf}R_L^{\\prime}}{${hi} + (${hi}${ho} - ${hf}${hr})R_L^{\\prime}}`,
    substitution: `A_v = \\frac{-(${n(h.hf)})(${n(rac)})}{${n(h.hi)} + [(${n(h.hi)})(${n(h.ho)}) - (${n(h.hf)})(${n(h.hr)})](${n(rac)})}`,
    result: `A_v = ${n(av)}\\quad(\\text{aproximado: } ${n((-h.hf * rac) / h.hi)})`,
  });
  steps.push({
    title: 'Impedancia de entrada',
    formula: `Z_i^{\\prime} = ${hi} - \\frac{${hf}${hr}R_L^{\\prime}}{1 + ${ho}R_L^{\\prime}},\\qquad Z_i = ${rinTex} \\parallel Z_i^{\\prime}`,
    substitution: `Z_i^{\\prime} = ${n(h.hi)} - \\frac{(${n(h.hf)})(${n(h.hr)})(${n(rac)})}{1 + (${n(h.ho)})(${n(rac)})}`,
    result: `Z_i^{\\prime} = ${ohm(ziT)},\\quad Z_i = ${ohm(zi)}\\quad(\\text{aproximado: } Z_i^{\\prime} \\approx ${ohm(h.hi)})`,
  });
  steps.push({
    title: 'Impedancia de salida',
    explanation:
      net.rs !== undefined
        ? `Se anula la fuente: la entrada queda cerrada por la resistencia de Thévenin R_s ∥ ${rinTex} = ${engText(rsTh, 'Ω')}.`
        : 'Se anula la fuente (ideal, R_s = 0): la entrada queda en cortocircuito.',
    formula: `Z_o^{\\prime} = \\frac{1}{${ho} - ${hf}${hr}/(${hi} + R_s)},\\qquad Z_o = R_C \\parallel Z_o^{\\prime}`,
    substitution: `Z_o^{\\prime} = \\frac{1}{${n(h.ho)} - (${n(h.hf)})(${n(h.hr)})/(${n(h.hi)} + ${n(rsTh)})}`,
    result: `Z_o^{\\prime} = ${ohm(zoT)},\\quad Z_o = ${ohm(zo)}`,
  });
  steps.push({
    title: 'Ganancia de corriente del amplificador',
    explanation: `La corriente de entrada se reparte entre ${rinTex} y Z_i′; si ${rinTex} ≫ Z_i′, A_i ≈ A_i′.`,
    formula: `A_i = A_i^{\\prime}\\frac{${rinTex}}{${rinTex} + Z_i^{\\prime}}`,
    result: `A_i = ${n(ai)}`,
  });
  const avs = loadSteps(net, { zi, zo, av, avNL }, steps);
  return { zi, zo, avNL, av, avs, ai, ziT, zoT, aiT, params: h, steps };
}
