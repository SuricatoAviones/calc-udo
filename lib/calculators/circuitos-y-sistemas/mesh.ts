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
import { formatNumber, toLatexNumber, TEX } from '@/lib/math/format';
import type { Notice, ResultTable, Step } from '../types';
import {
  componentLabel,
  componentUnit,
  storageElementsError,
  electronicElementsError,
  type CircuitComponent,
  type CircuitDocument,
  type GridPoint,
} from './circuit';
import { powerState, type BranchResult } from './mna';

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
  | 'elementos-no-admitidos'
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

/** Aristas del embebido: cada componente y cada tramo de cable. */
function edgesOf(doc: CircuitDocument): EdgeDef[] {
  const edges = doc.components.map((c): EdgeDef => ({
    key: c.id,
    kind: 'component',
    component: c,
    a: c.a,
    b: c.b,
  }));
  for (const w of doc.wires) {
    for (let i = 0; i < w.points.length - 1; i++) {
      edges.push({ key: `${w.id}#${i}`, kind: 'wire', a: w.points[i]!, b: w.points[i + 1]! });
    }
  }
  return edges;
}

/** Semiaristas que salen de cada vértice, ordenadas por ángulo. */
function outgoingByAngle(
  halfCount: number,
  fromOf: (h: number) => GridPoint,
  toOf: (h: number) => GridPoint,
): Map<string, number[]> {
  const adj = new Map<string, number[]>();
  for (let h = 0; h < halfCount; h++) {
    const k = keyOf(fromOf(h));
    const list = adj.get(k);
    if (list) list.push(h);
    else adj.set(k, [h]);
  }
  const angle = (h: number) => {
    const p = fromOf(h);
    const q = toOf(h);
    return Math.atan2(q.y - p.y, q.x - p.x);
  };
  for (const list of adj.values()) list.sort((h1, h2) => angle(h1) - angle(h2));
  return adj;
}

/** Recorre cada cara siguiendo `nextHalf` hasta volver a la semiarista inicial. */
function traceFaces(halfCount: number, nextHalf: (h: number) => number) {
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
  return { faceOfHalf, faces };
}

/** La cara exterior es la de mayor área absoluta; las acotadas (mallas) tienen el signo opuesto. */
function classifyFaces(faceArea: number[]) {
  let outer = 0;
  for (let i = 1; i < faceArea.length; i++) {
    if (Math.abs(faceArea[i]!) > Math.abs(faceArea[outer]!)) outer = i;
  }
  const outerSign = Math.sign(faceArea[outer] ?? 0) || -1;
  const boundedFaces: number[] = [];
  const meshOfFace = new Array<number>(faceArea.length).fill(-1);
  faceArea.forEach((area, i) => {
    if (i === outer || Math.sign(area) !== -outerSign || Math.abs(area) <= 1e-9) return;
    meshOfFace[i] = boundedFaces.length;
    boundedFaces.push(i);
  });
  return { boundedFaces, meshOfFace };
}

/** Recorre las caras del embebido planar (aristas = componentes + tramos de cable). */
function buildPlanarFaces(doc: CircuitDocument): PlanarFaces {
  const edges = edgesOf(doc);
  const halfCount = edges.length * 2;
  const fromOf = (h: number): GridPoint => (h % 2 === 0 ? edges[h >> 1]!.a : edges[h >> 1]!.b);
  const toOf = (h: number): GridPoint => (h % 2 === 0 ? edges[h >> 1]!.b : edges[h >> 1]!.a);
  const adj = outgoingByAngle(halfCount, fromOf, toOf);
  const posOf = new Map<number, number>();
  for (const list of adj.values()) list.forEach((h, i) => posOf.set(h, i));

  // Siguiente semiarista de la cara: la inmediatamente anterior en sentido horario a la gemela.
  const nextHalf = (h: number): number => {
    const twin = h ^ 1;
    const list = adj.get(keyOf(fromOf(twin)))!;
    const pos = posOf.get(twin)!;
    return list[(pos - 1 + list.length) % list.length]!;
  };
  const { faceOfHalf, faces } = traceFaces(halfCount, nextHalf);
  const faceArea = faces.map(
    (cycle) =>
      cycle.reduce((area, h) => {
        const p = fromOf(h);
        const q = toOf(h);
        return area + (p.x * q.y - q.x * p.y);
      }, 0) / 2,
  );
  const { boundedFaces, meshOfFace } = classifyFaces(faceArea);
  return { edges, faceOfHalf, faces, faceArea, boundedFaces, meshOfFace, fromOf, toOf };
}

function joinSigned(terms: string[]): string {
  if (terms.length === 0) return '0';
  const joined = terms.join(' ');
  return joined.startsWith('+ ') ? joined.slice(2) : joined;
}

/** Errores de los elementos dibujados: circuito vacío, almacenadores o no lineales. */
function elementsError(doc: CircuitDocument): MeshFailure | null {
  if (doc.components.length === 0) {
    return { ok: false, code: 'circuito-vacio', message: 'El circuito no tiene componentes.' };
  }
  const storage = storageElementsError(doc.components);
  if (storage) return { ok: false, code: 'elementos-almacenadores', message: storage.message };
  const electronic = electronicElementsError(doc.components);
  if (!electronic) return null;
  return {
    ok: false,
    code: electronic.code as 'elementos-no-lineales' | 'elementos-no-admitidos',
    message: electronic.message,
  };
}

/** ¿El dibujo es conexo? Así la cara exterior es única y las mallas se clasifican bien. */
function isConnected(edges: EdgeDef[]): boolean {
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
  return new Set(edges.map((e) => find(keyOf(e.a)))).size <= 1;
}

type FacesOf = (c: CircuitComponent) => [number, number];

/** Malla a cada lado de un componente: f1 para la semiarista a→b, f2 para b→a (−1: exterior). */
function componentFacesOf(planar: PlanarFaces): FacesOf {
  const edgeOfComponent = new Map<string, number>();
  planar.edges.forEach((e, i) => {
    if (e.kind === 'component' && e.component) edgeOfComponent.set(e.component.id, i);
  });
  return (c) => {
    const e = edgeOfComponent.get(c.id)!;
    return [
      planar.meshOfFace[planar.faceOfHalf[2 * e]!]!,
      planar.meshOfFace[planar.faceOfHalf[2 * e + 1]!]!,
    ];
  };
}

/** Ramas que no separan dos mallas distintas y mallas formadas solo por cables. */
function meshShapeError(
  doc: CircuitDocument,
  planar: PlanarFaces,
  facesOf: FacesOf,
): MeshFailure | null {
  const dangling = doc.components.find((c) => {
    const [f1, f2] = facesOf(c);
    return f1 === f2;
  });
  if (dangling) {
    return {
      ok: false,
      code: 'rama-colgante',
      message: `La rama ${componentLabel(dangling)} no forma parte de una malla (es colgante o un puente). Conéctala a ambos lados para incluirla.`,
    };
  }
  const wireOnly = planar.boundedFaces.findIndex(
    (gf) => !(planar.faces[gf] ?? []).some((h) => planar.edges[h >> 1]!.kind === 'component'),
  );
  if (wireOnly < 0) return null;
  return {
    ok: false,
    code: 'malla-sin-componentes',
    message: `La malla ${wireOnly + 1} está formada solo por cables; agrega un componente para poder calcular su corriente.`,
  };
}

interface KvlTerms {
  sym: string[];
  num: string[];
}

/** Sistema de mallas: M corrientes de malla + la tensión de cada fuente de corriente. */
interface MeshSystem {
  a: number[][];
  size: number;
  /** Columna de la tensión de cada fuente de corriente. */
  unknownOf: Map<string, number>;
  meshTerms: KvlTerms[];
}

/**
 * Aporte de un componente a la KVL de la malla `mf`, que lo recorre en el sentido `sign` (+1 de a
 * a b). `other` es la malla del otro lado (−1 si es la exterior).
 */
function addKvlTerm(
  system: Omit<MeshSystem, 'meshTerms'>,
  mf: number,
  c: CircuitComponent,
  sign: number,
  other: number,
  terms: KvlTerms,
) {
  const { a, size, unknownOf } = system;
  const label = componentLabel(c);
  if (c.kind === 'resistor') {
    addAt(a, mf, mf, c.value);
    if (other < 0) {
      terms.sym.push(`+ R_{${label}} i_${mf + 1}`);
      terms.num.push(`+ ${n(c.value)} i_${mf + 1}`);
      return;
    }
    addAt(a, mf, other, -c.value);
    terms.sym.push(`+ R_{${label}}(i_{${mf + 1}} - i_{${other + 1}})`);
    terms.num.push(`+ ${n(c.value)} (i_${mf + 1} - i_${other + 1})`);
    return;
  }
  if (c.kind === 'voltage-source') {
    addAt(a, mf, size, -sign * c.value);
    const s = sign > 0 ? '-' : '+';
    terms.sym.push(`${s} E_{${label}}`);
    terms.num.push(`${s} ${n(c.value)}`);
    return;
  }
  addAt(a, mf, unknownOf.get(c.id)!, sign);
  const s = sign > 0 ? '+' : '-';
  terms.sym.push(`${s} u_{${label}}`);
  terms.num.push(`${s} u_{${label}}`);
}

function buildMeshSystem(doc: CircuitDocument, planar: PlanarFaces, facesOf: FacesOf): MeshSystem {
  const M = planar.boundedFaces.length;
  const unknownOf = new Map<string, number>();
  for (const c of doc.components) {
    if (c.kind === 'current-source') unknownOf.set(c.id, M + unknownOf.size);
  }
  const size = M + unknownOf.size;
  const a: number[][] = Array.from({ length: size }, () => new Array(size + 1).fill(0));
  const system = { a, size, unknownOf };

  // Filas de KVL por malla.
  const meshTerms = planar.boundedFaces.map((gf, mf) => {
    const terms: KvlTerms = { sym: [], num: [] };
    for (const h of planar.faces[gf] ?? []) {
      const edge = planar.edges[h >> 1]!;
      if (edge.kind !== 'component') continue;
      const c = edge.component!;
      const [f1, f2] = facesOf(c);
      addKvlTerm(system, mf, c, h % 2 === 0 ? 1 : -1, f1 === mf ? f2 : f1, terms);
    }
    return terms;
  });

  // Filas de restricción de las fuentes de corriente: i_ab = I.
  for (const c of doc.components) {
    const row = unknownOf.get(c.id);
    if (row === undefined) continue;
    const [f1, f2] = facesOf(c);
    if (f1 >= 0) addAt(a, row, f1, 1);
    if (f2 >= 0) addAt(a, row, f2, -1);
    a[row]![size] = c.value;
  }
  return { ...system, meshTerms };
}

/** Corriente (diferencia de las mallas a cada lado), tensión y potencia de cada rama. */
function meshBranchResults(
  doc: CircuitDocument,
  facesOf: FacesOf,
  x: number[],
  unknownOf: Map<string, number>,
): BranchResult[] {
  return doc.components.map((c) => {
    const [f1, f2] = facesOf(c);
    const i = (f1 >= 0 ? x[f1]! : 0) - (f2 >= 0 ? x[f2]! : 0);
    let v: number;
    if (c.kind === 'resistor') v = c.value * i;
    else if (c.kind === 'voltage-source') v = c.value;
    else v = x[unknownOf.get(c.id)!]!;
    return { id: c.id, label: componentLabel(c), kind: c.kind, nodeA: 0, nodeB: 0, v, i, p: v * i };
  });
}

/** Componentes del borde de cada malla, sin repetir. */
function meshInfoOf(planar: PlanarFaces): MeshInfo[] {
  return planar.boundedFaces.map((gf) => {
    const comps: CircuitComponent[] = [];
    for (const h of planar.faces[gf] ?? []) {
      const edge = planar.edges[h >> 1]!;
      const c = edge.kind === 'component' ? edge.component : undefined;
      if (c && !comps.includes(c)) comps.push(c);
    }
    return { branches: comps.map((c) => componentLabel(c)), components: comps };
  });
}

/** Resuelve el circuito por análisis de mallas. */
export function solveMesh(doc: CircuitDocument): MeshOutcome {
  const invalid = elementsError(doc);
  if (invalid) return invalid;
  const planar = buildPlanarFaces(doc);
  if (!isConnected(planar.edges)) {
    return {
      ok: false,
      code: 'desconectado',
      message:
        'El dibujo tiene partes separadas. El análisis de mallas necesita un circuito conexo: únelas con un cable o un componente.',
    };
  }
  const M = planar.boundedFaces.length;
  if (M === 0) {
    return {
      ok: false,
      code: 'sin-mallas',
      message:
        'El circuito no tiene mallas: se necesitan componentes formando lazos cerrados (no solo cables).',
    };
  }
  const facesOf = componentFacesOf(planar);
  const shape = meshShapeError(doc, planar, facesOf);
  if (shape) return shape;

  const { a, size, unknownOf, meshTerms } = buildMeshSystem(doc, planar, facesOf);
  const k = unknownOf.size;

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
  const branchResults = meshBranchResults(doc, facesOf, x, unknownOf);
  const meshInfo = meshInfoOf(planar);

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
      estado: powerState(b.p),
    })),
  };

  const steps: Step[] = [
    {
      title: 'Identificación de mallas',
      explanation: `Se recorren las caras acotadas del dibujo y se asigna a cada una una corriente de malla en el sentido de su recorrido. Hay ${M} malla(s).`,
      result: meshInfo
        .map((info, mf) => String.raw`i_${mf + 1}:\ ${info.branches.join(TEX.listSep)}`)
        .join(String.raw`;\ `),
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
      result: meshCurrents
        .map((v, mf) => String.raw`i_${mf + 1} = ${n(v)}\text{ A}`)
        .join(String.raw`,\ `),
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
