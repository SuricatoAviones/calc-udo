import { describe, expect, it } from 'vitest';
import { solveNodal } from '../circuitos-y-sistemas/analisis-de-nodos';
import type { CircuitComponent, CircuitDocument } from '../circuitos-y-sistemas/circuit';
import {
  amplificadoresOperacionales,
  solveOpAmp,
  type OpAmpInput,
} from './amplificadores-operacionales';

const example = amplificadoresOperacionales.example;
const base: OpAmpInput = { ...example, analysis: 'configuracion' };

function solved(input: Partial<OpAmpInput>) {
  const result = solveOpAmp({ ...base, ...input });
  if (!result.ok) throw new Error('no debería fallar');
  return result;
}

function linear(input: Partial<OpAmpInput>) {
  const { value } = solved(input);
  if (value.kind !== 'lineal') throw new Error('se esperaba un circuito lineal');
  return value;
}

describe('circuitos lineales (Boylestad y Nashelsky, 10.ª ed. en español)', () => {
  it('ejemplo 10.5: inversor, R₁ = 100 kΩ, R_f = 500 kΩ, V₁ = 2 V → V_o = −10 V', () => {
    const v = linear({});
    expect(v.gain).toBeCloseTo(-5, 10);
    expect(v.vo).toBeCloseTo(-10, 10);
  });

  it('ejemplo 10.6: no inversor con los mismos valores → V_o = 12 V', () => {
    expect(linear({ circuit: 'no-inversor' }).vo).toBeCloseTo(12, 10);
  });

  it('ejemplo 11.1: inversor con R_f = 200 kΩ, R₁ = 2 kΩ y 2.5 mV → A = −100 y V_o = −250 mV', () => {
    const v = linear({ rf: 200e3, r1: 2e3, v1: 2.5e-3 });
    expect(v.gain).toBeCloseTo(-100, 10);
    expect(v.vo).toBeCloseTo(-0.25, 10);
  });

  it('ejemplo 11.2: no inversor con R_f = 240 kΩ y R₁ = 2.4 kΩ, 120 mV → A = 101 y V_o = 12.12 V', () => {
    // Errata: el libro escribe 12.12 mV; 101 × 120 mV = 12.12 V.
    const v = linear({ circuit: 'no-inversor', rf: 240e3, r1: 2.4e3, v1: 0.12 });
    expect(v.gain).toBeCloseTo(101, 10);
    expect(v.vo).toBeCloseTo(12.12, 10);
  });

  it('ejemplo 10.7: sumador con R_f = 1 MΩ → a) −7 V; b) +3 V', () => {
    expect(
      linear({ circuit: 'sumador', rf: 1e6, v1: 1, r1: 500e3, v2: 2, r2: 1e6, v3: 3, r3: 1e6 }).vo,
    ).toBeCloseTo(-7, 10);
    expect(
      linear({ circuit: 'sumador', rf: 1e6, v1: -2, r1: 200e3, v2: 3, r2: 500e3, v3: 1, r3: 1e6 })
        .vo,
    ).toBeCloseTo(3, 10);
  });

  it('ejemplo 11.6: sumador de dos entradas, 330 kΩ/33 kΩ y 330 kΩ/10 kΩ → V_o = −(10V₁ + 33V₂)', () => {
    // En el pico de cada senoidal: 50 mV y 10 mV → −(0.5 + 0.33) V.
    const v = linear({ circuit: 'sumador', rf: 330e3, r1: 33e3, r2: 10e3, v1: 0.05, v2: 0.01 });
    expect(v.vo).toBeCloseTo(-0.83, 10);
  });

  it('ejemplo 11.8: restador con R₁ = R₃ = 20 kΩ y R₂ = R₄ = 100 kΩ → V_o = V₁ − V₂', () => {
    const v = linear({
      circuit: 'diferencial',
      r1: 20e3,
      r3: 20e3,
      r2: 100e3,
      r4: 100e3,
      v1: 3,
      v2: 1.2,
    });
    expect(v.vo).toBeCloseTo(1.8, 10);
  });

  it('el seguidor copia la entrada y la salida se recorta en ±V_sat', () => {
    // Ecuación (10.10); el recorte es la definición de V_sat (Malvino, sec. 22-1), no un ejemplo del libro.
    expect(linear({ circuit: 'seguidor', v1: -3.5 }).vo).toBe(-3.5);
    const result = solved({ vsat: 13.5, v1: 4 });
    expect(result.value).toMatchObject({ kind: 'lineal', vo: -13.5, saturated: true });
    expect(result.notices[0]!.level).toBe('warning');
  });
});

describe('circuitos no lineales (Malvino, 6.ª ed. en español, cap. 22)', () => {
  it('ejemplos 22-4 y 22-5: referencia de 5 V y senoidal de 10 V de pico → ciclo de trabajo 33.3 %', () => {
    const { value } = solved({ circuit: 'comparador', vsat: 5, vref: 5, v1: 7, vp: 10 });
    if (value.kind !== 'comparador') throw new Error();
    expect(value.vo).toBe(5);
    expect(value.duty!).toBeCloseTo(0.333, 3);
  });

  it('ejemplo 22-6: Schmitt inversor con 1 kΩ y 47 kΩ y V_sat = 13.5 V → PCS = 0.281 V, PCI = −0.281 V, H = 0.562 V', () => {
    // El libro escribe "1 kΩ/40 kΩ", pero su B = 0.0208 es 1 kΩ/48 kΩ, como en la figura 22-21.
    const { value } = solved({
      circuit: 'schmitt',
      mode: 'inversor',
      r1: 1e3,
      r2: 47e3,
      vsat: 13.5,
    });
    if (value.kind !== 'schmitt') throw new Error();
    expect(value.b!).toBeCloseTo(0.0208, 4);
    expect(value.pcs).toBeCloseTo(0.281, 3);
    expect(value.pci).toBeCloseTo(-0.281, 3);
    expect(value.h).toBeCloseTo(0.562, 2);
  });

  it('Schmitt no inversor: PCS = (R₁/R₂)V_sat (Malvino, ecs. 22-10 y 22-11)', () => {
    // Sin ejemplo numérico en el libro; se verifica la ecuación con R₁/R₂ = 1/10 y V_sat = 13.5 V.
    const { value } = solved({
      circuit: 'schmitt',
      mode: 'no-inversor',
      r1: 10e3,
      r2: 100e3,
      vsat: 13.5,
    });
    if (value.kind !== 'schmitt') throw new Error();
    expect(value.pcs).toBeCloseTo(1.35, 10);
    expect(value.h).toBeCloseTo(2.7, 10);
  });

  it('pide V_sat para el comparador', () => {
    expect(
      amplificadoresOperacionales.inputSchema.safeParse({ ...base, circuit: 'comparador' }).success,
    ).toBe(false);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    expect(amplificadoresOperacionales.inputSchema.safeParse(example).success).toBe(true);
    expect(amplificadoresOperacionales.solve(example).ok).toBe(true);
    expect(amplificadoresOperacionales.solve(base).ok).toBe(true);
  });
});

// ─── Circuitos dibujados en el constructor ──────────────────────────────────

/** [tipo, etiqueta, nodo a, nodo b, valor, nodo c]. En el amplificador: entrada −, entrada +, salida. */
type Part = [CircuitComponent['kind'], string, string, string, number, string?];

/** Circuito por nodos (ver el helper de los tests de diodos): cada nodo es un punto de la rejilla. */
function net(parts: Part[], ground = '0'): CircuitDocument {
  const index = new Map<string, number>();
  const at = (name: string) => {
    if (!index.has(name)) index.set(name, index.size);
    return { x: 4 * index.get(name)!, y: 0 };
  };
  at(ground);
  return {
    components: parts.map(([kind, label, a, b, value, c]) => ({
      id: label.toLowerCase(),
      kind,
      a: at(a),
      b: at(b),
      ...(c ? { c: at(c) } : {}),
      value,
      label,
    })),
    wires: [],
    ground: at(ground),
  };
}

function drawn(parts: Part[], vsat?: number) {
  return solveOpAmp({ ...example, analysis: 'circuito', vsat, network: net(parts) });
}

function network(parts: Part[], vsat?: number) {
  const result = drawn(parts, vsat);
  if (!result.ok) throw new Error(result.error.message);
  if (result.value.kind !== 'red') throw new Error('se esperaba el modo circuito');
  const value = result.value;
  return { value, result, op: (label: string) => value.opamps.find((o) => o.label === label)! };
}

describe('amplificadores dibujados en el tablero (Boylestad y Nashelsky, 10.ª ed. en español)', () => {
  it('ejemplo 10.5 (el de la calculadora): inversor con 100 kΩ y 500 kΩ → V_o = −10 V y A_v = −5', () => {
    const result = solveOpAmp(example);
    if (!result.ok || result.value.kind !== 'red') throw new Error();
    const u1 = result.value.opamps[0]!;
    expect(u1.vout).toBeCloseTo(-10, 10);
    expect(u1.gain!).toBeCloseTo(-5, 10);
    // Cortocircuito virtual: la entrada − queda en 0 V, como la +.
    expect(u1.vminus).toBeCloseTo(0, 10);
    expect(u1.loop).toBeLessThan(0);
  });

  it('ejemplo 10.6: no inversor con R₁ = 100 kΩ y R_f = 500 kΩ → V_o = 12 V', () => {
    const { op } = network([
      ['voltage-source', 'V1', 'in', '0', 2],
      ['resistor', 'R1', 'n', '0', 100e3],
      ['resistor', 'Rf', 'n', 'out', 500e3],
      ['opamp', 'U1', 'n', 'in', 0, 'out'],
    ]);
    expect(op('U1').vout).toBeCloseTo(12, 10);
    expect(op('U1').gain!).toBeCloseTo(6, 10);
  });

  it('ejemplo 10.7: sumador con R_f = 1 MΩ → a) −7 V; b) +3 V', () => {
    const summing = (v1: number, r1: number, v2: number, r2: number, v3: number, r3: number) =>
      network([
        ['voltage-source', 'V1', 'a', '0', v1],
        ['voltage-source', 'V2', 'b', '0', v2],
        ['voltage-source', 'V3', 'c', '0', v3],
        ['resistor', 'R1', 'a', 'n', r1],
        ['resistor', 'R2', 'b', 'n', r2],
        ['resistor', 'R3', 'c', 'n', r3],
        ['resistor', 'Rf', 'n', 'out', 1e6],
        ['opamp', 'U1', 'n', '0', 0, 'out'],
      ]).op('U1').vout;
    expect(summing(1, 500e3, 2, 1e6, 3, 1e6)).toBeCloseTo(-7, 10);
    expect(summing(-2, 200e3, 3, 500e3, 1, 1e6)).toBeCloseTo(3, 10);
  });

  it('ejemplo 11.3: tres etapas (no inversora y dos inversoras) con 80 µV → V_o ≈ 1.78 V', () => {
    // Errata de la traducción: el texto dice 80 mV, pero 22.2 × 10³ × 80 mV serían 1780 V; el
    // resultado del libro (1.78 V) corresponde a 80 µV.
    const { op } = network([
      ['voltage-source', 'Vi', 'in', '0', 80e-6],
      ['resistor', 'R1', 'n1', '0', 4.3e3],
      ['resistor', 'Rf1', 'n1', 'o1', 470e3],
      ['opamp', 'U1', 'n1', 'in', 0, 'o1'],
      ['resistor', 'R2', 'o1', 'n2', 33e3],
      ['resistor', 'Rf2', 'n2', 'o2', 470e3],
      ['opamp', 'U2', 'n2', '0', 0, 'o2'],
      ['resistor', 'R3', 'o2', 'n3', 33e3],
      ['resistor', 'Rf3', 'n3', 'o3', 470e3],
      ['opamp', 'U3', 'n3', '0', 0, 'o3'],
    ]);
    // El libro redondea las ganancias (110.3)(−14.2)(−14.2) = 22.2 × 10³; sin redondear,
    // 110.302·14.242² = 22 375 y V_o = 1.79 V.
    expect(op('U3').gain! / 1e3).toBeCloseTo(22.2, 0);
    expect(op('U3').vout).toBeCloseTo(1.78, 1);
  });

  it('ejemplo 11.7: restador de dos etapas (R_f = 1 MΩ, R₁ = 100 kΩ, R₂ = 50 kΩ, R₃ = 500 kΩ) → V_o = 20(V₁ − V₂)', () => {
    // El libro da la expresión; se comprueba con V₁ = 1.5 V y V₂ = 1 V: 20(0.5) = 10 V.
    const { op } = network([
      ['voltage-source', 'V1', 'a', '0', 1.5],
      ['voltage-source', 'V2', 'b', '0', 1],
      ['resistor', 'R1', 'a', 'n1', 100e3],
      ['resistor', 'Rf1', 'n1', 'o1', 1e6],
      ['opamp', 'U1', 'n1', '0', 0, 'o1'],
      ['resistor', 'R3', 'o1', 'n2', 500e3],
      ['resistor', 'R2', 'b', 'n2', 50e3],
      ['resistor', 'Rf2', 'n2', 'o2', 1e6],
      ['opamp', 'U2', 'n2', '0', 0, 'o2'],
    ]);
    expect(op('U2').vout).toBeCloseTo(10, 10);
  });

  it('ejemplo 11.8: restador con un amplificador (20 kΩ y 100 kΩ) → V_o = V₁ − V₂', () => {
    // Fig. 11.11: V₁ llega a la entrada + por el divisor R₁–R₃; V₂ entra por R₂ a la −; R₄ realimenta.
    const { op } = network([
      ['voltage-source', 'V1', 'a', '0', 3],
      ['voltage-source', 'V2', 'b', '0', 1.2],
      ['resistor', 'R1', 'a', 'p', 20e3],
      ['resistor', 'R3', 'p', '0', 20e3],
      ['resistor', 'R2', 'b', 'n', 100e3],
      ['resistor', 'R4', 'n', 'out', 100e3],
      ['opamp', 'U1', 'n', 'p', 0, 'out'],
    ]);
    expect(op('U1').vout).toBeCloseTo(1.8, 10);
  });

  it('seguidor de voltaje (ec. 10.10): V_o = V₁ y la salida entrega la corriente de la carga', () => {
    const { op } = network([
      ['voltage-source', 'V1', 'in', '0', 3.5],
      ['opamp', 'U1', 'out', 'in', 0, 'out'],
      ['resistor', 'RL', 'out', '0', 1e3],
    ]);
    expect(op('U1').vout).toBeCloseTo(3.5, 10);
    expect(op('U1').iout).toBeCloseTo(3.5e-3, 12);
  });

  it('con V_sat recorta la salida (caso construido: inversor ×5 con 4 V y V_sat = 13.5 V)', () => {
    // Sin ejemplo en el libro: la salida lineal sería −20 V y queda en −13.5 V.
    const result = drawn(
      [
        ['voltage-source', 'V1', 'a', '0', 4],
        ['resistor', 'R1', 'a', 'n', 100e3],
        ['resistor', 'Rf', 'n', 'out', 500e3],
        ['opamp', 'U1', 'n', '0', 0, 'out'],
      ],
      13.5,
    );
    if (!result.ok || result.value.kind !== 'red') throw new Error();
    expect(result.value.opamps[0]!.vout).toBeCloseTo(-13.5, 10);
    expect(result.value.opamps[0]!.saturated).toBe(-1);
    expect(result.notices.some((x) => x.level === 'warning')).toBe(true);
  });

  it('rechaza la realimentación positiva (disparador de Schmitt) y el lazo abierto (comparador)', () => {
    const schmitt = drawn([
      ['voltage-source', 'V1', 'in', '0', 1],
      ['resistor', 'R1', 'p', '0', 1e3],
      ['resistor', 'R2', 'p', 'out', 47e3],
      ['opamp', 'U1', 'in', 'p', 0, 'out'],
    ]);
    expect(schmitt.ok).toBe(false);
    if (!schmitt.ok) expect(schmitt.error.code).toBe('sin-realimentacion-negativa');
    const comparator = drawn([
      ['voltage-source', 'V1', 'in', '0', 1],
      ['resistor', 'RL', 'out', '0', 1e3],
      ['opamp', 'U1', '0', 'in', 0, 'out'],
    ]);
    expect(comparator.ok).toBe(false);
  });

  it('las calculadoras de circuitos lineales rechazan los amplificadores', () => {
    const result = solveNodal({ circuit: example.network });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('elementos-no-admitidos');
  });
});
