import { describe, expect, it } from 'vitest';
import {
  buildTopology,
  componentLabel,
  componentUnit,
  emptyCircuit,
  formatEngineering,
  nextLabel,
  parseEngineering,
  validateTopology,
  type CircuitComponent,
  type CircuitDocument,
} from './circuit';

function r(
  id: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  value: number,
  label?: string,
): CircuitComponent {
  return { id, kind: 'resistor', a, b, value, label };
}

function v(
  id: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  value: number,
  label?: string,
): CircuitComponent {
  return { id, kind: 'voltage-source', a, b, value, label };
}

function i(
  id: string,
  a: { x: number; y: number },
  b: { x: number; y: number },
  value: number,
  label?: string,
): CircuitComponent {
  return { id, kind: 'current-source', a, b, value, label };
}

function w(id: string, points: { x: number; y: number }[]) {
  return { id, points };
}

describe('notación de ingeniería', () => {
  it.each([
    ['10k', 10e3],
    ['2.2µ', 2.2e-6],
    ['100m', 0.1],
    ['5', 5],
    ['3,3k', 3300],
    ['1.5M', 1.5e6],
    // Con la unidad, como la muestra el editor de propiedades.
    ['2.2 kΩ', 2200],
    ['10 µF', 1e-5],
    ['−0,3 A', -0.3],
    ['150 mV', 0.15],
    ['bad', null],
  ])('parseEngineering(%s) → %s', (text, expected) => {
    expect(parseEngineering(text)).toBe(expected);
  });

  it('formatea valores con prefijo', () => {
    expect(formatEngineering(10e3, 'Ω')).toBe('10 kΩ');
    expect(formatEngineering(2.2e-6, 'F')).toBe('2.2 µF');
    expect(formatEngineering(0.05, 'A')).toBe('50 mA');
    expect(formatEngineering(0)).toBe('0');
  });
});

describe('etiquetado', () => {
  it('usa el prefijo correcto por tipo', () => {
    expect(componentLabel(r('r1', { x: 0, y: 0 }, { x: 1, y: 0 }, 1, 'R5'))).toBe('R5');
    expect(componentUnit('resistor')).toBe('Ω');
    expect(componentUnit('voltage-source')).toBe('V');
    expect(componentUnit('current-source')).toBe('A');
  });

  it('asigna la siguiente etiqueta libre', () => {
    const doc: CircuitDocument = {
      ...emptyCircuit(),
      components: [r('r1', { x: 0, y: 0 }, { x: 1, y: 0 }, 1, 'R1')],
    };
    expect(nextLabel(doc, 'resistor')).toBe('R2');
    expect(nextLabel(doc, 'voltage-source')).toBe('V1');
  });
});

describe('topología', () => {
  it('construye nodos y referencia desde tierra', () => {
    const doc: CircuitDocument = {
      components: [
        v('v1', { x: 0, y: 0 }, { x: 0, y: 2 }, 10, 'V1'),
        r('r1', { x: 0, y: 2 }, { x: 0, y: 4 }, 5, 'R1'),
      ],
      wires: [],
      ground: { x: 0, y: 4 },
    };
    const topo = buildTopology(doc);
    expect(topo.referenceNode).toBe(topo.nodeOf.get('0,4'));
    expect(topo.nodes.length).toBe(3);
    expect(topo.components).toHaveLength(2);
  });

  it('une terminales a través de cables', () => {
    const doc: CircuitDocument = {
      components: [
        v('v1', { x: 0, y: 0 }, { x: 0, y: 2 }, 10),
        r('r1', { x: 4, y: 2 }, { x: 4, y: 4 }, 5),
      ],
      wires: [
        w('w1', [
          { x: 0, y: 2 },
          { x: 2, y: 2 },
          { x: 2, y: 4 },
          { x: 4, y: 4 },
        ]),
      ],
      ground: { x: 4, y: 4 },
    };
    const topo = buildTopology(doc);
    // El terminal negativo de V1, el cable y un extremo de R1 deben estar en el mismo nodo.
    expect(topo.nodeOf.get('0,2')).toBe(topo.nodeOf.get('4,4'));
    expect(validateTopology(topo)).toBeNull();
  });

  it('detecta circuito vacío', () => {
    const topo = buildTopology(emptyCircuit());
    expect(validateTopology(topo)?.code).toBe('circuito-vacio');
  });

  it('detecta circuito desconectado', () => {
    const doc: CircuitDocument = {
      components: [
        v('v1', { x: 0, y: 0 }, { x: 0, y: 2 }, 10),
        r('r1', { x: 4, y: 0 }, { x: 4, y: 2 }, 5),
      ],
      wires: [],
      ground: { x: 0, y: 2 },
    };
    const topo = buildTopology(doc);
    expect(validateTopology(topo)?.code).toBe('circuito-desconectado');
  });

  it('detecta lazo de fuentes de voltaje', () => {
    const doc: CircuitDocument = {
      components: [
        v('v1', { x: 0, y: 0 }, { x: 2, y: 0 }, 10),
        v('v2', { x: 2, y: 0 }, { x: 2, y: 2 }, 5),
        v('v3', { x: 2, y: 2 }, { x: 0, y: 2 }, 3),
        v('v4', { x: 0, y: 2 }, { x: 0, y: 0 }, 2),
      ],
      wires: [],
      ground: { x: 0, y: 0 },
    };
    const topo = buildTopology(doc);
    expect(validateTopology(topo)?.code).toBe('lazo-de-fuentes-de-voltaje');
  });

  it('detecta corte de fuentes de corriente', () => {
    const doc: CircuitDocument = {
      components: [
        i('i1', { x: 0, y: 0 }, { x: 2, y: 0 }, 1),
        i('i2', { x: 2, y: 0 }, { x: 4, y: 0 }, 2),
      ],
      wires: [],
      ground: { x: 4, y: 0 },
    };
    const topo = buildTopology(doc);
    expect(validateTopology(topo)?.code).toBe('corte-de-fuentes-de-corriente');
  });
});
