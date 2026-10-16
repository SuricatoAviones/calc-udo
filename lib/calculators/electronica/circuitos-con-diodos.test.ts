import { describe, expect, it } from 'vitest';
import { solveNodal } from '../circuitos-y-sistemas/analisis-de-nodos';
import type { CircuitComponent, CircuitDocument } from '../circuitos-y-sistemas/circuit';
import { circuitosConDiodos, solveDiode, type DiodeInput } from './circuitos-con-diodos';

const base: DiodeInput = {
  ...circuitosConDiodos.example,
  mode: 'serie',
  source: 10,
  resistance: 500,
  orientation: 'directa',
  model: 'segunda',
  vk: 0.7,
  rb: 0,
  is: 10e-12,
  n: 1.5,
  vt: 0.026,
};

function solved(input: Partial<DiodeInput>) {
  const result = solveDiode({ ...base, ...input });
  if (!result.ok) throw new Error(result.error.message);
  if (result.value.mode !== 'serie') throw new Error('se esperaba el modo serie');
  return result.value;
}

describe('circuitos con diodos', () => {
  it('Boylestad y Nashelsky, 10.ª ed., ejemplo 2.3 (ideal): E = 10 V, R = 0.5 kΩ → I_D = 20 mA', () => {
    const value = solved({ model: 'ideal' });
    expect(value.id).toBeCloseTo(0.02, 12);
    expect(value.vd).toBe(0);
  });

  it('Boylestad, ejemplo 2.2 (modelo aproximado de silicio): V_DQ = 0.7 V, I_DQ ≈ 18.5 mA', () => {
    // El libro lee 18.5 mA en la gráfica; (10 − 0.7)/0.5 kΩ = 18.6 mA.
    const value = solved({});
    expect(value.vd).toBe(0.7);
    expect(value.id * 1000).toBeCloseTo(18.6, 10);
  });

  it('Boylestad, sec. 2.2 (Mathcad, fig. 2.7): Shockley con I_S = 10 pA y nV_T = 39 mV → 18.336 mA, 0.8319 V', () => {
    const value = solved({ model: 'real' });
    expect(value.id * 1000).toBeCloseTo(18.336, 3);
    expect(value.vd).toBeCloseTo(0.831853, 5);
  });

  it('Boylestad, ejemplo 2.4: E = 8 V, R = 2.2 kΩ (Si) → V_R = 7.3 V, I_D = 3.32 mA', () => {
    const value = solved({ source: 8, resistance: 2200 });
    expect(value.vr).toBeCloseTo(7.3, 10);
    expect(value.id * 1000).toBeCloseTo(3.32, 2);
  });

  it('Boylestad, ejemplo 2.5: con el diodo invertido, I_D = 0 y toda la fuente queda en el diodo', () => {
    // La calculadora mide V_D de ánodo a cátodo (−8 V); el libro marca la polaridad al revés y
    // escribe V_D = E = 8 V.
    const value = solved({ source: 8, resistance: 2200, orientation: 'inversa' });
    expect(value.conducting).toBe(false);
    expect(value.id).toBe(0);
    expect(value.vd).toBe(-8);
  });

  it('Boylestad, ejemplo 2.6: E = 0.5 V no enciende el diodo de silicio', () => {
    const value = solved({ source: 0.5, resistance: 1200 });
    expect(value.conducting).toBe(false);
    expect(value.vr).toBe(0);
    expect(value.vd).toBe(0.5);
  });

  it('Boylestad, ejemplo 2.7: silicio + LED (V_K = 0.7 + 1.8 V), E = 12 V, R = 680 Ω → 13.97 mA', () => {
    const value = solved({ source: 12, resistance: 680, vk: 2.5 });
    expect(value.vr).toBeCloseTo(9.5, 10);
    expect(value.id * 1000).toBeCloseTo(13.97, 2);
  });

  it('Malvino, 6.ª ed., ejemplo 3-6 (segunda aproximación): 9.3 V, 9.3 mA y 6.51 mW', () => {
    const value = solved({ source: 10, resistance: 1000 });
    expect(value.vr).toBeCloseTo(9.3, 10);
    expect(value.pd * 1000).toBeCloseTo(6.51, 10);
  });

  it('Malvino, ejemplo 3-9 (tercera aproximación): R_L = 10 Ω, r_B = 0.23 Ω → 0.909 A, V_L = 9.09 V', () => {
    const value = solved({ source: 10, resistance: 10, model: 'tercera', rb: 0.23 });
    expect(value.id).toBeCloseTo(0.909, 3);
    expect(value.vr).toBeCloseTo(9.09, 2);
    expect(value.vd).toBeCloseTo(0.909, 3);
  });

  it('Malvino, ejemplo 3-8: si r_B < 0.01·R se puede ignorar', () => {
    const result = solveDiode({
      ...base,
      source: 10,
      resistance: 1000,
      model: 'tercera',
      rb: 0.23,
    });
    expect(result.notices.some((n) => n.message.includes('1 %'))).toBe(true);
    if (!result.ok || result.value.mode !== 'serie') return;
    // 9.3 V/1000.23 Ω: prácticamente los 9.3 mA de la segunda aproximación.
    expect(result.value.id * 1000).toBeCloseTo(9.3, 2);
  });

  it('el ejemplo cumple el schema y se resuelve', () => {
    const calc = circuitosConDiodos;
    expect(calc.inputSchema.safeParse(calc.example).success).toBe(true);
    expect(calc.solve(calc.example).ok).toBe(true);
  });
});

// ─── Redes dibujadas en el constructor ──────────────────────────────────────

type Part = [CircuitComponent['kind'], string, string, string, number];

/**
 * Circuito a partir de una lista de nodos: cada nodo es un punto de la rejilla y los componentes
 * van de nodo a nodo (los terminales que coinciden quedan unidos). En las fuentes de voltaje el
 * primer nodo es el +; en los diodos, el ánodo. Los nodos se numeran en el orden en que aparecen,
 * empezando por la referencia «0».
 */
function net(parts: Part[], ground = '0'): CircuitDocument {
  const index = new Map<string, number>();
  const at = (name: string) => {
    if (!index.has(name)) index.set(name, index.size);
    return { x: 4 * index.get(name)!, y: 0 };
  };
  at(ground);
  return {
    components: parts.map(([kind, label, a, b, value]) => ({
      id: label.toLowerCase(),
      kind,
      a: at(a),
      b: at(b),
      value,
      label,
    })),
    wires: [],
    ground: at(ground),
  };
}

function network(parts: Part[], model: DiodeInput['model'] = 'segunda', rb = 0) {
  const result = solveDiode({ ...base, mode: 'circuito', model, rb, circuit: net(parts) });
  if (!result.ok) throw new Error(result.error.message);
  if (result.value.mode !== 'circuito') throw new Error('se esperaba el modo circuito');
  const value = result.value;
  const diode = (label: string) => value.diodes.find((d) => d.label === label)!;
  const branch = (label: string) => value.branches.find((b) => b.label === label)!;
  return { value, diode, branch, result };
}

describe('redes con diodos (Boylestad y Nashelsky, 10.ª ed. en español, sec. 2.3 a 2.5)', () => {
  it('ejemplo 2.7: silicio y LED rojo (1.8 V) en serie con 12 V y 680 Ω → V_o = 9.5 V, I_D = 13.97 mA', () => {
    const { diode, branch } = network([
      ['voltage-source', 'E', 'a', '0', 12],
      ['diode', 'D1', 'a', 'b', 0.7],
      ['diode', 'D2', 'b', 'c', 1.8],
      ['resistor', 'R', 'c', '0', 680],
    ]);
    expect(branch('R').v).toBeCloseTo(9.5, 10);
    expect(diode('D1').current * 1e3).toBeCloseTo(13.97, 2);
    expect(diode('D2').on).toBe(true);
  });

  it('ejemplo 2.8: silicio y germanio invertido → I_D = 0, V_o = 0 y el germanio soporta los 20 V', () => {
    const { diode, branch } = network([
      ['voltage-source', 'E', 'a', '0', 20],
      ['diode', 'D1', 'a', 'b', 0.7],
      ['diode', 'D2', 'c', 'b', 0.3],
      ['resistor', 'R', 'c', '0', 5600],
    ]);
    expect(diode('D1').on).toBe(false);
    expect(diode('D1').current).toBe(0);
    // «Cuando I_D = 0, V_D = 0»: el diodo de silicio queda con 0 V y el de germanio con todo E.
    expect(diode('D1').vd).toBeCloseTo(0, 10);
    expect(diode('D2').vd).toBeCloseTo(-20, 10);
    expect(branch('R').v).toBeCloseTo(0, 10);
  });

  it('ejemplo 2.9: E1 = 10 V, R1 = 4.7 kΩ, silicio, R2 = 2.2 kΩ y E2 = −5 V → I = 2.07 mA, V_o = −0.45 V', () => {
    const { value, branch } = network([
      ['voltage-source', 'E1', 'a', '0', 10],
      ['resistor', 'R1', 'a', 'b', 4700],
      ['diode', 'D', 'b', 'c', 0.7],
      ['resistor', 'R2', 'c', 'd', 2200],
      ['voltage-source', 'E2', 'd', '0', -5],
    ]);
    expect(branch('R1').i * 1e3).toBeCloseTo(2.07, 2);
    // El libro multiplica con I = 2.07 mA ya redondeada; con 2.0725 mA, V1 = 9.741 V,
    // V2 = 4.559 V y V_o = −0.441 V.
    expect(branch('R1').v).toBeCloseTo(9.73, 1);
    expect(branch('R2').v).toBeCloseTo(4.55, 1);
    // V_o es el nodo entre el diodo y R2 («c», el cuarto nodo: 0, a, b, c).
    expect(value.nodeVoltages[3]).toBeCloseTo(-0.45, 1);
  });

  it('ejemplo 2.10: dos diodos de silicio en paralelo → V_o = 0.7 V, I₁ = 28.18 mA e I_D1 = I_D2 = 14.09 mA', () => {
    const { diode, branch, result } = network([
      ['voltage-source', 'E', 'a', '0', 10],
      ['resistor', 'R', 'a', 'b', 330],
      ['diode', 'D1', 'b', '0', 0.7],
      ['diode', 'D2', 'b', '0', 0.7],
    ]);
    expect(branch('R').i * 1e3).toBeCloseTo(28.18, 2);
    expect(diode('D1').vd).toBeCloseTo(0.7, 10);
    expect(diode('D1').current * 1e3).toBeCloseTo(14.09, 2);
    expect(diode('D2').current * 1e3).toBeCloseTo(14.09, 2);
    expect(result.notices.some((x) => x.message.includes('paralelo'))).toBe(true);
  });

  it('ejemplo 2.11: LED verde y rojo (2 V) en antiparalelo con 8 V y 300 Ω → 20 mA por el verde', () => {
    const { diode } = network([
      ['voltage-source', 'E', 'a', '0', 8],
      ['resistor', 'R', 'a', 'b', 300],
      ['diode', 'Verde', 'b', '0', 2],
      ['diode', 'Rojo', '0', 'b', 2],
    ]);
    expect(diode('Verde').current * 1e3).toBeCloseTo(20, 10);
    expect(diode('Rojo').on).toBe(false);
    expect(diode('Rojo').vd).toBeCloseTo(-2, 10);
  });

  it('ejemplo 2.12: silicio en paralelo con un LED verde (2.2 V, tabla 1.8) → solo conduce el silicio y V_o = 11.3 V', () => {
    const { diode, branch } = network([
      ['voltage-source', 'E', 'a', '0', 12],
      ['diode', 'Verde', 'a', 'b', 2.2],
      ['diode', 'Si', 'a', 'b', 0.7],
      ['resistor', 'R', 'b', '0', 2200],
    ]);
    expect(diode('Si').on).toBe(true);
    expect(diode('Verde').on).toBe(false);
    expect(branch('R').v).toBeCloseTo(11.3, 10);
  });

  it('ejemplo 2.13 (el de la calculadora): I₁ = 0.212 mA, I₂ = 3.32 mA e I_D2 = 3.11 mA', () => {
    const result = solveDiode(circuitosConDiodos.example);
    if (!result.ok || result.value.mode !== 'circuito') throw new Error();
    const { diodes, branches } = result.value;
    expect(branches.find((b) => b.label === 'R1')!.i * 1e3).toBeCloseTo(0.212, 3);
    expect(branches.find((b) => b.label === 'R2')!.i * 1e3).toBeCloseTo(3.32, 2);
    // 3.3214 − 0.2121 = 3.1093 mA; el libro escribe ≅ 3.11 mA.
    expect(diodes.find((d) => d.label === 'D2')!.current * 1e3).toBeCloseTo(3.11, 2);
    expect(diodes.find((d) => d.label === 'D1')!.current * 1e3).toBeCloseTo(3.32, 2);
  });

  it('ejemplo 2.14: compuerta OR con 10 V en una entrada y 0 V en la otra → V_o = 9.3 V', () => {
    const { diode, branch } = network([
      ['voltage-source', 'E', 'p', '0', 10],
      ['diode', 'D1', 'p', 'o', 0.7],
      ['diode', 'D2', '0', 'o', 0.7],
      ['resistor', 'R', 'o', '0', 1000],
    ]);
    expect(branch('R').v).toBeCloseTo(9.3, 10);
    expect(diode('D1').current * 1e3).toBeCloseTo(9.3, 10);
    expect(diode('D2').on).toBe(false);
  });

  it('ejemplo 2.15: compuerta AND con 10 V en una entrada y 0 V en la otra → V_o = 0.7 V, I = 9.3 mA', () => {
    const { diode, value } = network([
      ['voltage-source', 'E1', 'p', '0', 10],
      ['diode', 'D1', 'o', 'p', 0.7],
      ['diode', 'D2', 'o', '0', 0.7],
      ['resistor', 'R', 'e', 'o', 1000],
      ['voltage-source', 'E', 'e', '0', 10],
    ]);
    expect(diode('D1').on).toBe(false);
    expect(diode('D2').current * 1e3).toBeCloseTo(9.3, 10);
    // Nodos: 0, p, o, e.
    expect(value.nodeVoltages[2]).toBeCloseTo(0.7, 10);
  });

  it('modelo ideal en la red: con E = 10 V y 0.5 kΩ coincide con el ejemplo 2.3 (20 mA)', () => {
    const { diode } = network(
      [
        ['voltage-source', 'E', 'a', '0', 10],
        ['resistor', 'R', 'a', 'b', 500],
        ['diode', 'D', 'b', '0', 0.7],
      ],
      'ideal',
    );
    expect(diode('D').current).toBeCloseTo(0.02, 12);
    expect(diode('D').vd).toBeCloseTo(0, 12);
  });

  it('tercera aproximación en la red: Malvino, ejemplo 3-9 (10 V, 10 Ω, r_B = 0.23 Ω) → 0.909 A', () => {
    const { diode } = network(
      [
        ['voltage-source', 'E', 'a', '0', 10],
        ['diode', 'D', 'a', 'b', 0.7],
        ['resistor', 'R', 'b', '0', 10],
      ],
      'tercera',
      0.23,
    );
    expect(diode('D').current).toBeCloseTo(0.909, 3);
    expect(diode('D').vd).toBeCloseTo(0.909, 3);
  });

  it('la traza muestra cada suposición y su verificación', () => {
    const result = solveDiode(circuitosConDiodos.example);
    expect(result.steps.some((s) => s.title.startsWith('Suposición'))).toBe(true);
    expect(result.tables.some((t) => t.id === 'suposiciones')).toBe(true);
    expect(result.tables.some((t) => t.id === 'diodos')).toBe(true);
  });

  it('la característica real no se usa en el circuito dibujado', () => {
    const input = { ...circuitosConDiodos.example, model: 'real' };
    expect(circuitosConDiodos.inputSchema.safeParse(input).success).toBe(false);
  });

  it('las calculadoras de circuitos lineales rechazan los diodos', () => {
    const result = solveNodal({ circuit: circuitosConDiodos.example.circuit });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('elementos-no-lineales');
  });
});
