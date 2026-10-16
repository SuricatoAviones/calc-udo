import { describe, expect, it } from 'vitest';
import type { BlockDiagramDocument } from './block-diagram';
import { diagramToGraph, junctionPoints } from './block-diagram';
import { KUO_FIG_3_17_BRANCHES, OGATA_FIG_3_9 } from './examples';
import {
  reduccionDeDiagramasDeBloques,
  type ReductionInput,
} from './reduccion-de-diagramas-de-bloques';
import { frEquivalent, frTex, parseGain } from './symbolic';
import { reduceDiagram } from './reduction';
import { resolveGraph } from './graph-input';

const base: ReductionInput = reduccionDeDiagramasDeBloques.example;
const run = (input: Partial<ReductionInput>) =>
  reduccionDeDiagramasDeBloques.solve({ ...base, ...input });
const gain = (s: string) => {
  const r = parseGain(s);
  if (!r.ok) throw new Error(r.message);
  return r.value;
};

/** R → (+, −) → G → C con realimentación H por abajo. */
function feedbackLoop(
  forward: string,
  feedback: string,
  sign: '+' | '-' = '-',
): BlockDiagramDocument {
  return {
    elements: [
      { id: 'r', kind: 'input', x: 0, y: 0, dir: 0, label: 'R' },
      { id: 's', kind: 'sum', x: 3, y: 0, dir: 0, signs: { back: '+', right: sign } },
      { id: 'g', kind: 'block', x: 7, y: 0, dir: 0, gain: forward },
      { id: 'h', kind: 'block', x: 7, y: 3, dir: 2, gain: feedback },
      { id: 'c', kind: 'output', x: 12, y: 0, dir: 0, label: 'C' },
    ],
    wires: [
      {
        id: 'a',
        points: [
          { x: 0, y: 0 },
          { x: 2, y: 0 },
        ],
      },
      {
        id: 'b',
        points: [
          { x: 4, y: 0 },
          { x: 5, y: 0 },
        ],
      },
      {
        id: 'c',
        points: [
          { x: 9, y: 0 },
          { x: 12, y: 0 },
        ],
      },
      {
        id: 'd',
        points: [
          { x: 10, y: 0 },
          { x: 10, y: 3 },
          { x: 9, y: 3 },
        ],
      },
      {
        id: 'e',
        points: [
          { x: 5, y: 3 },
          { x: 3, y: 3 },
          { x: 3, y: 1 },
        ],
      },
    ],
  };
}

describe('reducción de diagramas de bloques', () => {
  it('el ejemplo cumple el schema', () => {
    expect(reduccionDeDiagramasDeBloques.inputSchema.safeParse(base).success).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 3-1 (fig. 3-9): se elimina el lazo positivo de H1, luego el de H2 y
  // por último el exterior. C/R = G1G2G3/(1 − G1G2H1 + G2G3H2 + G1G2G3).
  it('Ogata, ejemplo 3-1: C/R del sistema de lazos múltiples', () => {
    const result = run({});
    expect(result.ok).toBe(true);
    const graph = resolveGraph({ ...base });
    if (!graph.ok) throw new Error(graph.message);
    const reduced = reduceDiagram(graph.graph, 'R', 'C');
    if (!reduced.ok) throw new Error(reduced.message);
    expect(
      frEquivalent(reduced.result.transfer, gain('G1G2G3/(1 - G1G2H1 + G2G3H2 + G1G2G3)')),
    ).toBe(true);
    // El lazo positivo de H1 aparece como G1G2/(1 − G1G2H1), como en la fig. 3-9(c).
    const texts = JSON.stringify(reduced.result.steps);
    expect(texts).toContain('1 - G_{1}G_{2}H_{1}');
    // El resultado queda sin factores repetidos. Los términos de Δ se ordenan por grado y por
    // nombre, no en el orden de los lazos del libro.
    expect(frTex(reduced.result.transfer)).toBe(
      '\\frac{G_{1}G_{2}G_{3}}{1 + G_{1}G_{2}G_{3} - G_{1}G_{2}H_{1} + G_{2}G_{3}H_{2}}',
    );
  });

  // Kuo, 7.ª ed., fig. 3-17: el mismo resultado que la fórmula de Mason (ec. 3-65 y 3-66).
  it('Kuo, fig. 3-17: reducción del flujograma con dos trayectorias', () => {
    const result = run({
      mode: 'flujograma',
      branches: KUO_FIG_3_17_BRANCHES,
      input: 'R',
      output: 'Y',
    });
    if (!result.ok) throw new Error(result.error.message);
    const graph = resolveGraph({ ...base, mode: 'flujograma', input: 'R', output: 'Y' });
    if (!graph.ok) throw new Error(graph.message);
    const reduced = reduceDiagram(graph.graph, 'R', 'Y');
    if (!reduced.ok) throw new Error(reduced.message);
    expect(
      frEquivalent(
        reduced.result.transfer,
        gain('(G1G2G3 + G1G4)/(1 + G1G2H1 + G2G3H2 + G1G2G3 + G4H2 + G1G4)'),
      ),
    ).toBe(true);
  });

  // Ogata, 3.ª ed., ec. (3-6): C/R = G/(1 + GH); con G = 10/[s(s + 1)] y H = 1 queda
  // 10/(s² + s + 10) (desarrollado a mano).
  it('un lazo dibujado con ganancias en s', () => {
    const result = run({
      mode: 'diagrama',
      diagram: feedbackLoop('10/(s(s+1))', '1'),
      input: '',
      output: '',
    });
    if (!result.ok) throw new Error(result.error.message);
    expect(result.value.rational).toEqual({ num: [10], den: [1, 1, 10] });
    const symbolic = run({
      mode: 'diagrama',
      diagram: feedbackLoop('G', 'H'),
      input: '',
      output: '',
    });
    if (!symbolic.ok) throw new Error(symbolic.error.message);
    expect(symbolic.value.canonicalTex).toBe('\\frac{G}{1 + GH}');
    const positive = run({
      mode: 'diagrama',
      diagram: feedbackLoop('G', 'H', '+'),
      input: '',
      output: '',
    });
    if (!positive.ok) throw new Error(positive.error.message);
    expect(positive.value.canonicalTex).toBe('\\frac{G}{1 - GH}');
  });

  it('las bifurcaciones del dibujo se marcan y los cruces no conectan', () => {
    const points = junctionPoints(OGATA_FIG_3_9);
    expect(points).toEqual(
      expect.arrayContaining([
        { x: 23, y: 0 },
        { x: 30, y: 0 },
        { x: 31, y: 0 },
      ]),
    );
    // El cable de H2 cruza el de H1 en (16, −3) sin unirse: siguen siendo señales distintas.
    const converted = diagramToGraph(OGATA_FIG_3_9);
    if (!converted.ok) throw new Error(converted.message);
    expect(converted.value.graph.branches).toHaveLength(11);
  });

  it('errores del dibujo', () => {
    const doc = feedbackLoop('G', 'H');
    const noInput = run({
      mode: 'diagrama',
      diagram: { ...doc, elements: doc.elements.filter((e) => e.kind !== 'input') },
    });
    expect(!noInput.ok && noInput.error.code).toBe('sin-entrada');
    const noOutput = run({
      mode: 'diagrama',
      diagram: { ...doc, elements: doc.elements.filter((e) => e.kind !== 'output') },
    });
    expect(!noOutput.ok && noOutput.error.code).toBe('sin-salida');
    const loose = run({
      mode: 'diagrama',
      diagram: { ...doc, wires: doc.wires.filter((w) => w.id !== 'b') },
    });
    expect(!loose.ok && loose.error.code).toBe('terminal-sin-conectar');
    const badGain = run({ mode: 'diagrama', diagram: feedbackLoop('G^x', 'H') });
    expect(!badGain.ok && badGain.error.code).toBe('ganancia-invalida');
    // Dos salidas unidas: la de H va también a la salida C.
    const joined = run({
      mode: 'diagrama',
      diagram: {
        ...doc,
        wires: [
          ...doc.wires,
          {
            id: 'z',
            points: [
              { x: 5, y: 3 },
              { x: 5, y: 6 },
              { x: 12, y: 6 },
              { x: 12, y: 0 },
            ],
          },
        ],
      },
    });
    expect(!joined.ok && joined.error.code).toBe('salidas-unidas');
    const empty = run({ mode: 'diagrama', diagram: { elements: [], wires: [] } });
    expect(!empty.ok && empty.error.code).toBe('diagrama-vacio');
  });
});
