/**
 * Análisis de mallas para circuitos planares dibujados sin cruces.
 *
 * Las mallas son las **caras acotadas** del embebido planar del dibujo: se recorren las
 * semiaristas ordenando por ángulo las aristas que salen de cada vértice. A cada malla se le
 * asigna una corriente en el sentido de su recorrido y se escribe una KVL. Las resistencias
 * comparten ramas entre dos mallas; las fuentes de voltaje aportan su tensión; las fuentes de
 * corriente añaden su tensión como incógnita y su ecuación de corriente (equivalente a la
 * supermalla). El sistema se resuelve reutilizando la eliminación de `metodos-numericos/matrix`.
 *
 * Fuentes: Hayt, Kemmerly & Durbin, *Análisis de Circuitos en Ingeniería*, 7.ª ed., cap. 4.
 */
import {
  backSubstitution,
  forwardElimination,
  texAugmented,
} from '@/lib/calculators/metodos-numericos/matrix';
import { formatNumber, toLatexNumber } from '@/lib/math/format';
import type { Notice, ResultTable, Step } from '../types';
import {
  componentLabel,
  componentUnit,
  storageElementsError,
  diodeElementsError,
  type CircuitComponent,
  type CircuitDocument,
  type GridPoint,
} from './circuit';
import type { BranchResult } from './mna';

const DIGITS = 6;
const n = (v: number) => toLatexNumber(v, DIGITS);

function addAt(m: number[][], r: number, c: number, v: number) {
  m[r]![c] = m[r]![c]! + v;
}

function keyOf(p: GridPoint) {
  return `${p.x},${p.y}`;
}

interface EdgeDef {
  key: string;
  kind: 'component' | 'wire';
  component?: CircuitComponent;
  a: GridPoint;
  b: GridPoint;
}

export interface MeshInfo {
  /** Ramas que forman el borde de la malla. */
  branches: string[];
  /** Componentes sobre el borde. */
  components: CircuitComponent[];
}

export interface MeshResult {
  meshCurrents: number[];
  branchResults: BranchResult[];
  meshes: MeshInfo[];
}

export type MeshErrorCode =
  | 'circuito-vacio'
  | 'desconectado'
  | 'sin-mallas'
  | 'rama-colgante'
  | 'malla-sin-componentes'
  | 'elementos-almacenadores'
  | 'elementos-no-lineales'
  | 'singular';

export interface MeshSolve {
  ok: true;
  result: MeshResult;
  steps: Step[];
  tables: ResultTable[];
  notices: Notice[];
}

export interface MeshFailure {
  ok: false;
  code: MeshErrorCode;
  message: string;
}

export type MeshOutcome = MeshSolve | MeshFailure;

interface PlanarFaces {
  edges: EdgeDef[];
  faceOfHalf: number[];
  faces: number[][];
  faceArea: number[];
  /** Caras acotadas (mallas), en orden. */
  boundedFaces: number[];
  /** Cara geométrica → índice de malla, o −1 si es la cara exterior. */
  meshOfFace: number[];
  fromOf: (h: number) => GridPoint;
  toOf: (h: number) => GridPoint;
}

/** Recorre las caras del embebido planar (aristas = componentes + tramos de cable). */
function buildPlanarFaces(doc: CircuitDocument): PlanarFaces {
  const edges: EdgeDef[] = [];
  for (const c of doc.components) {
    edges.push({ key: c.id, kind: 'component', component: c, a: c.a, b: c.b });
  }
  for (const w of doc.wires) {
    for (let i = 0; i < w.points.length - 1; i++) {
      edges.push({ key: `${w.id}#${i}`, kind: 'wire', a: w.points[i]!, b: w.points[i + 1]! });
    }
  }
  const halfCount = edges.length * 2;
  const fromOf = (h: number): GridPoint => (h % 2 === 0 ? edges[h >> 1]!.a : edges[h >> 1]!.b);
  const toOf = (h: number): GridPoint => (h % 2 === 0 ? edges[h >> 1]!.b : edges[h >> 1]!.a);

  // Semiaristas que salen de cada vértice, ordenadas por ángulo.
  const adj = new Map<string, number[]>();
  for (let h = 0; h < halfCount; h++) {
    const k = keyOf(fromOf(h));
    const list = adj.get(k);
    if (list) list.push(h);
    else adj.set(k, [h]);
  }
  for (const list of adj.values()) {
    list.sort((h1, h2) => {
      const p1 = fromOf(h1);
      const q1 = toOf(h1);
      const p2 = fromOf(h2);
      const q2 = toOf(h2);
      return Math.atan2(q1.y - p1.y, q1.x - p1.x) - Math.atan2(q2.y - p2.y, q2.x - p2.x);
    });
  }
  const posOf = new Map<number, number>();
  for (const list of adj.values()) list.forEach((h, i) => posOf.set(h, i));

  // Siguiente semiarista de la cara: la inmediatamente anterior en sentido horario a la gemela.
  const nextHalf = (h: number): number => {
    const twin = h ^ 1;
    const list = adj.get(keyOf(fromOf(twin)))!;
    const pos = posOf.get(twin)!;
    return list[(pos - 1 + list.length) % list.length]!;
  };

  const faceOfHalf = new Array<number>(halfCount).fill(-1);
  const faces: number[][] = [];
  for (let h = 0; h < halfCount; h++) {
    if (faceOfHalf[h] !== -1) continue;
    const faceIdx = faces.length;
    const cycle: number[] = [];
    let cur = h;
    let guard = 0;
    do {
      faceOfHalf[cur] = faceIdx;
      cycle.push(cur);
      cur = nextHalf(cur);
      guard++;
    } while (cur !== h && guard <= halfCount + 1);
    faces.push(cycle);
  }

  const faceArea = faces.map((cycle) => {
    let area = 0;
    for (const h of cycle) {
      const p = fromOf(h);
      const q = toOf(h);
      area += p.x * q.y - q.x * p.y;
    }
    return area / 2;
  });

  // La cara exterior es la de mayor área absoluta; las acotadas tienen el signo opuesto.
  let outer = 0;
  for (let i = 1; i < faceArea.length; i++) {
    if (Math.abs(faceArea[i]!) > Math.abs(faceArea[outer]!)) outer = i;
  }
  const outerSign = Math.sign(faceArea[outer] ?? 0) || -1;
  const boundedFaces: number[] = [];
  const meshOfFace = new Array<number>(faces.length).fill(-1);
  for (let i = 0; i < faces.length; i++) {
    if (i === outer) continue;
    if (Math.sign(faceArea[i]!) === -outerSign && Math.abs(faceArea[i]!) > 1e-9) {
      meshOfFace[i] = boundedFaces.length;
      boundedFaces.push(i);
    }
  }

  return { edges, faceOfHalf, faces, faceArea, boundedFaces, meshOfFace, fromOf, toOf };
}

function joinSigned(terms: string[]): string {
  if (terms.length === 0) return '0';
  const joined = terms.join(' ');
  return joined.startsWith('+ ') ? joined.slice(2) : joined;
}

/** Resuelve el circuito por análisis de mallas. */
export function solveMesh(doc: CircuitDocument): MeshOutcome {
  if (doc.components.length === 0) {
    return { ok: false, code: 'circuito-vacio', message: 'El circuito no tiene componentes.' };
  }
  const storage = storageElementsError(doc.components);
  if (storage) return { ok: false, code: 'elementos-almacenadores', message: storage.message };
  const diodes = diodeElementsError(doc.components);
  if (diodes) return { ok: false, code: 'elementos-no-lineales', message: diodes.message };
  const planar = buildPlanarFaces(doc);
  const { edges, faceOfHalf, faces, boundedFaces, meshOfFace } = planar;

  // El dibujo debe ser conexo: la cara exterior es única y así se clasifican bien las mallas.
  const parent = new Map<string, string>();
  const find = (k: string): string => {
    let r = k;
    while (parent.get(r) !== r) r = parent.get(r)!;
    return r;
  };
  for (const e of edges) {
    for (const p of [keyOf(e.a), keyOf(e.b)]) if (!parent.has(p)) parent.set(p, p);
    const ra = find(keyOf(e.a));
    const rb = find(keyOf(e.b));
    if (ra !== rb) parent.set(ra, rb);
  }
  const roots = new Set<string>();
  for (const e of edges) roots.add(find(keyOf(e.a)));
  if (roots.size > 1) {
    return {
      ok: false,
      code: 'desconectado',
      message:
        'El dibujo tiene partes separadas. El análisis de mallas necesita un circuito conexo: únelas con un cable o un componente.',
    };
  }

  const M = boundedFaces.length;

  if (M === 0) {
    return {
      ok: false,
      code: 'sin-mallas',
      message:
        'El circuito no tiene mallas: se necesitan componentes formando lazos cerrados (no solo cables).',
    };
  }

  const edgeOfComponent = new Map<string, number>();
  edges.forEach((e, i) => {
    if (e.kind === 'component' && e.component) edgeOfComponent.set(e.component.id, i);
  });

  // Cara de cada lado de un componente: f1 para la semiarista a→b, f2 para b→a.
  const componentFaces = (c: CircuitComponent): [number, number] => {
    const e = edgeOfComponent.get(c.id)!;
    return [meshOfFace[faceOfHalf[2 * e]!]!, meshOfFace[faceOfHalf[2 * e + 1]!]!];
  };

  for (const c of doc.components) {
    const [f1, f2] = componentFaces(c);
    if (f1 === f2) {
      return {
        ok: false,
        code: 'rama-colgante',
        message: `La rama ${componentLabel(c)} no forma parte de una malla (es colgante o un puente). Conéctala a ambos lados para incluirla.`,
      };
    }
  }

  for (let mf = 0; mf < M; mf++) {
    const gf = boundedFaces[mf]!;
    const hasComponent = (faces[gf] ?? []).some((h) => edges[h >> 1]!.kind === 'component');
    if (!hasComponent) {
      return {
        ok: false,
        code: 'malla-sin-componentes',
        message: `La malla ${mf + 1} está formada solo por cables; agrega un componente para poder calcular su corriente.`,
      };
    }
  }

  // Incógnitas: M corrientes de malla + una tensión por fuente de corriente.
  const currentSourceUnknown = new Map<string, number>();
  let k = 0;
  for (const c of doc.components) {
    if (c.kind === 'current-source') currentSourceUnknown.set(c.id, M + k++);
  }
  const size = M + k;
  const a: number[][] = Array.from({ length: size }, () => Array(size + 1).fill(0));

  // Filas de KVL por malla.
  const meshTerms: { sym: string[]; num: string[] }[] = [];
  for (let mf = 0; mf < M; mf++) {
    const gf = boundedFaces[mf]!;
    const sym: string[] = [];
    const num: string[] = [];
    for (const h of faces[gf] ?? []) {
      const e = h >> 1;
      const edge = edges[e]!;
      if (edge.kind !== 'component') continue;
      const c = edge.component!;
      const sign = h % 2 === 0 ? 1 : -1;
      const [f1, f2] = componentFaces(c);
      const other = f1 === mf ? f2 : f1;
      if (c.kind === 'resistor') {
        addAt(a, mf, mf, c.value);
        if (other >= 0) addAt(a, mf, other, -c.value);
        const label = componentLabel(c);
        if (other >= 0) {
          sym.push(`+ R_{${label}}(i_{${mf + 1}} - i_{${other + 1}})`);
          num.push(`+ ${n(c.value)} (i_${mf + 1} - i_${other + 1})`);
        } else {
          sym.push(`+ R_{${label}} i_${mf + 1}`);
          num.push(`+ ${n(c.value)} i_${mf + 1}`);
        }
      } else if (c.kind === 'voltage-source') {
        addAt(a, mf, size, -sign * c.value);
        const label = componentLabel(c);
        if (sign > 0) {
          sym.push(`- E_{${label}}`);
          num.push(`- ${n(c.value)}`);
        } else {
          sym.push(`+ E_{${label}}`);
          num.push(`+ ${n(c.value)}`);
        }
      } else {
        const u = currentSourceUnknown.get(c.id)!;
        addAt(a, mf, u, sign);
        const label = componentLabel(c);
        sym.push(`${sign > 0 ? '+' : '-'} u_{${label}}`);
        num.push(`${sign > 0 ? '+' : '-'} u_{${label}}`);
      }
    }
    meshTerms.push({ sym, num });
  }

  // Filas de restricción de las fuentes de corriente: i_ab = I.
  for (const c of doc.components) {
    if (c.kind !== 'current-source') continue;
    const row = currentSourceUnknown.get(c.id)!;
    const [f1, f2] = componentFaces(c);
    if (f1 >= 0) addAt(a, row, f1, 1);
    if (f2 >= 0) addAt(a, row, f2, -1);
    a[row]![size] = c.value;
  }

  const elim = forwardElimination(a, { pivotColumns: size, pivoting: true, augmentedColumns: 1 });
  if (elim.zeroPivotColumn !== null) {
    return {
      ok: false,
      code: 'singular',
      message:
        'El sistema de mallas es singular. Revisa fuentes de voltaje en paralelo dentro de una misma malla o fuentes de corriente mal conectadas.',
    };
  }
  const { x, steps: backSteps } = backSubstitution(elim.upper);
  const meshCurrents = x.slice(0, M);

  // Corrientes y potencias por rama.
  const branchResults: BranchResult[] = [];
  for (const c of doc.components) {
    const [f1, f2] = componentFaces(c);
    const i = (f1 >= 0 ? x[f1]! : 0) - (f2 >= 0 ? x[f2]! : 0);
    let v: number;
    if (c.kind === 'resistor') v = c.value * i;
    else if (c.kind === 'voltage-source') v = c.value;
    else v = x[currentSourceUnknown.get(c.id)!]!;
    branchResults.push({
      id: c.id,
      label: componentLabel(c),
      kind: c.kind,
      nodeA: 0,
      nodeB: 0,
      v,
      i,
      p: v * i,
    });
  }

  // Tabla de mallas.
  const meshInfo: MeshInfo[] = boundedFaces.map((gf) => {
    const comps: CircuitComponent[] = [];
    const seen = new Set<string>();
    for (const h of faces[gf] ?? []) {
      const edge = edges[h >> 1]!;
      if (edge.kind !== 'component' || !edge.component) continue;
      if (seen.has(edge.component.id)) continue;
      seen.add(edge.component.id);
      comps.push(edge.component);
    }
    return { branches: comps.map((c) => componentLabel(c)), components: comps };
  });

  const meshTable: ResultTable = {
    id: 'mallas',
    title: 'Mallas del circuito',
    columns: [
      { key: 'malla', header: 'Malla' },
      { key: 'ramas', header: 'Ramas del borde' },
      { key: 'corriente', header: 'Corriente (A)' },
    ],
    rows: meshInfo.map((info, mf) => ({
      malla: `Malla ${mf + 1}`,
      ramas: info.branches.join(', '),
      corriente: formatNumber(meshCurrents[mf]!, DIGITS),
    })),
  };

  const branchTable: ResultTable = {
    id: 'ramas',
    title: 'Corrientes y potencias por rama',
    columns: [
      { key: 'rama', header: 'Rama' },
      { key: 'v', header: 'V (V)' },
      { key: 'i', header: 'I (A)' },
      { key: 'p', header: 'P (W)' },
      { key: 'estado', header: 'Estado' },
    ],
    rows: branchResults.map((b) => ({
      rama: `${b.label} (${componentUnit(b.kind)})`,
      v: formatNumber(b.v, DIGITS),
      i: formatNumber(b.i, DIGITS),
      p: formatNumber(b.p, DIGITS),
      estado: Math.abs(b.p) < 1e-12 ? 'cero' : b.p > 0 ? 'absorbe' : 'entrega',
    })),
  };

  const steps: Step[] = [
    {
      title: 'Identificación de mallas',
      explanation: `Se recorren las caras acotadas del dibujo y se asigna a cada una una corriente de malla en el sentido de su recorrido. Hay ${M} malla(s).`,
      result: meshInfo
        .map((info, mf) => `i_${mf + 1}:\\ ${info.branches.join(',\\ ')}`)
        .join(';\\ '),
    },
    ...meshTerms.map((terms, mf) => ({
      title: `KVL en la malla ${mf + 1}`,
      explanation:
        'La suma de caídas de tensión a lo largo del recorrido de la malla es cero. Las ramas compartidas con otra malla usan la diferencia de corrientes.',
      formula: `${joinSigned(terms.sym)} = 0`,
      substitution: `${joinSigned(terms.num)} = 0`,
    })),
    {
      title: 'Sistema de ecuaciones aumentado',
      explanation:
        k > 0
          ? 'Las primeras filas son las KVL de cada malla; las últimas son las ecuaciones de corriente de las fuentes de corriente (con su tensión como incógnita, equivalente a una supermalla).'
          : 'Cada fila es la KVL de una malla. La última columna es el lado derecho.',
      result: texAugmented(a, 1, DIGITS),
    },
    ...elim.steps,
    ...backSteps,
    {
      title: 'Corrientes de malla',
      explanation: 'Se despejan las corrientes de cada malla.',
      result: meshCurrents.map((v, mf) => `i_${mf + 1} = ${n(v)}\\text{ A}`).join(',\\ '),
    },
  ];

  const notices: Notice[] = [];
  if (k > 0) {
    notices.push({
      level: 'info',
      message:
        'Hay fuentes de corriente: se agregó la tensión de cada una como incógnita y su ecuación de corriente (método de la supermalla).',
    });
  }
  const totalPower = branchResults.reduce((s, b) => s + b.p, 0);
  if (Math.abs(totalPower) > 1e-6) {
    notices.push({
      level: 'warning',
      message: `Balance de potencias desviado (${formatNumber(totalPower, DIGITS)} W); revisa los valores o la precisión.`,
    });
  }

  return {
    ok: true,
    result: { meshCurrents, branchResults, meshes: meshInfo },
    steps,
    tables: [meshTable, branchTable],
    notices,
  };
}
