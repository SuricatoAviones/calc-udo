import { describe, expect, it } from 'vitest';
import { gananciaDeMason, type MasonInput } from './ganancia-de-mason';
import { KUO_EC_3_42_BRANCHES, KUO_FIG_3_17_BRANCHES, OGATA_FIG_3_9 } from './examples';
import { mason } from './signal-flow';
import { frEquivalent, parseGain, type FRat } from './symbolic';
import { resolveGraph } from './graph-input';

const g = (source: string): FRat => {
  const r = parseGain(source);
  if (!r.ok) throw new Error(r.message);
  return r.value;
};

const base: MasonInput = gananciaDeMason.example;

function run(input: Partial<MasonInput>) {
  return gananciaDeMason.solve({ ...base, ...input });
}

function graphOf(branches: MasonInput['branches']) {
  const r = resolveGraph({ ...base, mode: 'flujograma', branches, input: '', output: '' });
  if (!r.ok) throw new Error(r.message);
  return r.graph;
}

describe('fórmula de ganancia de Mason', () => {
  it('el ejemplo cumple el schema', () => {
    expect(gananciaDeMason.inputSchema.safeParse(gananciaDeMason.example).success).toBe(true);
  });

  // Kuo, 7.ª ed., sec. 3-9, fig. 3-17 y ec. (3-65) a (3-67): dos trayectorias directas
  // (G1G2G3 y G1G4), cinco lazos que se tocan entre sí y
  // Δ = 1 + G1G2H1 + G2G3H2 + G1G2G3 + G4H2 + G1G4.
  it('Kuo, fig. 3-17: Y/R = (G1G2G3 + G1G4)/Δ', () => {
    const result = run({});
    expect(result.ok).toBe(true);
    const outcome = mason(graphOf(KUO_FIG_3_17_BRANCHES), 'R', 'Y');
    if (!outcome.ok) throw new Error(outcome.message);
    const { paths, loops, combos, delta, transfer } = outcome.result;
    expect(paths.map((p) => p.gain).every(Boolean)).toBe(true);
    expect(paths).toHaveLength(2);
    expect(loops).toHaveLength(5);
    expect(combos).toHaveLength(0);
    expect(frEquivalent(delta, g('1 + G1G2H1 + G2G3H2 + G1G2G3 + G4H2 + G1G4'))).toBe(true);
    expect(
      frEquivalent(transfer, g('(G1G2G3 + G1G4)/(1 + G1G2H1 + G2G3H2 + G1G2G3 + G4H2 + G1G4)')),
    ).toBe(true);
  });

  // Kuo, ec. (3-67): E/R = (1 + G1G2H1 + G2G3H2 + G4H2)/Δ.
  it('Kuo, ec. 3-67: la señal de error E/R', () => {
    const outcome = mason(graphOf(KUO_FIG_3_17_BRANCHES), 'R', 'E');
    if (!outcome.ok) throw new Error(outcome.message);
    expect(
      frEquivalent(
        outcome.result.transfer,
        g('(1 + G1G2H1 + G2G3H2 + G4H2)/(1 + G1G2H1 + G2G3H2 + G1G2G3 + G4H2 + G1G4)'),
      ),
    ).toBe(true);
  });

  // Kuo, ec. (3-42) y (3-55): cuatro lazos L1 = a23a32, L2 = a34a43, L3 = a24a43a32, L4 = a44 y
  // un solo par que no se toca (L1 y L4). Δ = 1 − (a23a32 + a34a43 + a24a32a43 + a44) + a23a32a44.
  // Errata: la ec. (3-56) solo usa las trayectorias a12a23a34a45 y a12a25, pero la rama a24 de la
  // ec. (3-42) forma una tercera, y1 → y2 → y4 → y5 (a12a24a45, con Δ3 = 1): la calculadora la
  // incluye. La ec. (3-57), y2/y1 = a12(1 − a34a43 − a44)/Δ, sí coincide.
  it('Kuo, ec. 3-55 a 3-57: Δ con un par de lazos que no se tocan', () => {
    const graph = graphOf(KUO_EC_3_42_BRANCHES);
    const y5 = mason(graph, 'y1', 'y5');
    if (!y5.ok) throw new Error(y5.message);
    expect(y5.result.loops).toHaveLength(4);
    expect(y5.result.combos).toEqual([[expect.any(Number), expect.any(Number)]]);
    const delta = '1 - (a23 a32 + a34 a43 + a24 a32 a43 + a44) + a23 a32 a44';
    expect(frEquivalent(y5.result.delta, g(delta))).toBe(true);
    expect(y5.result.paths).toHaveLength(3);
    expect(
      frEquivalent(
        y5.result.transfer,
        g(`(a12 a23 a34 a45 + a12 a25 (1 - a34 a43 - a44) + a12 a24 a45)/(${delta})`),
      ),
    ).toBe(true);
    const y2 = mason(graph, 'y1', 'y2');
    if (!y2.ok) throw new Error(y2.message);
    expect(frEquivalent(y2.result.transfer, g(`a12 (1 - a34 a43 - a44)/(${delta})`))).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 3-1: el denominador es 1 − (suma de los lazos) porque los tres lazos
  // se tocan; C/R = G1G2G3/(1 − G1G2H1 + G2G3H2 + G1G2G3).
  it('Ogata, ejemplo 3-1, sobre el diagrama dibujado', () => {
    const result = run({ mode: 'diagrama', input: '', output: '', diagram: OGATA_FIG_3_9 });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.paths).toBe(1);
    expect(result.value.loops).toBe(3);
    const outcome = mason(
      (() => {
        const r = resolveGraph({
          ...base,
          mode: 'diagrama',
          input: '',
          output: '',
          diagram: OGATA_FIG_3_9,
        });
        if (!r.ok) throw new Error(r.message);
        return r.graph;
      })(),
      'R',
      'C',
    );
    if (!outcome.ok) throw new Error(outcome.message);
    expect(frEquivalent(outcome.result.transfer, g('G1G2G3/(1 - G1G2H1 + G2G3H2 + G1G2G3)'))).toBe(
      true,
    );
  });

  // Kuo, ec. (3-49) a (3-52): un solo lazo, M = G/(1 + GH).
  it('Kuo, ec. 3-52: un lazo de realimentación negativa', () => {
    const result = run({
      branches: [
        { from: 'R', to: 'E', gain: '1' },
        { from: 'E', to: 'Y', gain: 'G' },
        { from: 'Y', to: 'E', gain: '-H' },
      ],
      input: 'R',
      output: 'Y',
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.transferTex).toBe('\\frac{G}{1 + GH}');
  });

  // Caso con ganancias en s (verificado a mano: 10/[s(s + 1)] con realimentación unitaria da
  // 10/(s² + s + 10)).
  it('con ganancias en s da un cociente de polinomios', () => {
    const result = run({
      branches: [
        { from: 'R', to: 'E', gain: '1' },
        { from: 'E', to: 'C', gain: '10/(s(s+1))' },
        { from: 'C', to: 'E', gain: '-1' },
      ],
      input: 'R',
      output: 'C',
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.rational).toEqual({ num: [10], den: [1, 1, 10] });
  });

  it('un nodo de entrada que recibe ramas se separa con una rama unitaria', () => {
    const result = run({
      branches: [
        { from: 'x1', to: 'x2', gain: 'a' },
        { from: 'x2', to: 'x1', gain: 'b' },
      ],
      input: 'x1',
      output: 'x2',
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.transferTex).toBe('\\frac{a}{1 - ab}');
  });

  it('errores: sin ramas, sin trayectoria, nodo inexistente, misma entrada y salida, ganancia inválida', () => {
    expect(run({ branches: [] }).ok).toBe(false);
    const noPath = run({
      branches: [
        { from: 'a', to: 'b', gain: 'G' },
        { from: 'c', to: 'b', gain: 'H' },
      ],
      input: 'a',
      output: 'c',
    });
    expect(!noPath.ok && noPath.error.code).toBe('sin-trayectoria');
    const missing = run({ input: 'Z' });
    expect(!missing.ok && missing.error.code).toBe('nodo-inexistente');
    const same = run({ input: 'R', output: 'R' });
    expect(!same.ok && same.error.code).toBe('entrada-igual-a-salida');
    const bad = run({ branches: [{ from: 'R', to: 'C', gain: 'G^x' }], input: '', output: '' });
    expect(!bad.ok && bad.error.code).toBe('ganancia-invalida');
  });
});
