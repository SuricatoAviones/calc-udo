/**
 * Diagramas y flujogramas de los libros, compartidos por las calculadoras de la Unidad I y sus
 * tests.
 */
import type { BlockDiagramDocument } from './block-diagram';

/**
 * Ogata, 3.ª ed., ejemplo 3-1 y figura 3-9(a) (5.ª ed., ejemplo 2-1): sistema de lazos
 * múltiples con G1, G2 y G3 en cascada, H1 (realimentación positiva de la salida de G2 al punto
 * suma antes de G1), H2 (realimentación negativa de C al punto suma antes de G2) y el lazo
 * exterior unitario negativo. C/R = G1G2G3/(1 − G1G2H1 + G2G3H2 + G1G2G3).
 */
export const OGATA_FIG_3_9: BlockDiagramDocument = {
  elements: [
    { id: 'r', kind: 'input', x: 0, y: 0, dir: 0, label: 'R' },
    { id: 's1', kind: 'sum', x: 3, y: 0, dir: 0, signs: { back: '+', right: '-' } },
    { id: 's2', kind: 'sum', x: 7, y: 0, dir: 0, signs: { back: '+', left: '+' } },
    { id: 'g1', kind: 'block', x: 11, y: 0, dir: 0, gain: 'G1' },
    { id: 's3', kind: 'sum', x: 16, y: 0, dir: 0, signs: { back: '+', left: '-' } },
    { id: 'g2', kind: 'block', x: 20, y: 0, dir: 0, gain: 'G2' },
    { id: 'g3', kind: 'block', x: 27, y: 0, dir: 0, gain: 'G3' },
    { id: 'c', kind: 'output', x: 33, y: 0, dir: 0, label: 'C' },
    { id: 'h1', kind: 'block', x: 11, y: -3, dir: 2, gain: 'H1' },
    { id: 'h2', kind: 'block', x: 24, y: -6, dir: 2, gain: 'H2' },
  ],
  wires: [
    {
      id: 'w1',
      points: [
        { x: 0, y: 0 },
        { x: 2, y: 0 },
      ],
    },
    {
      id: 'w2',
      points: [
        { x: 4, y: 0 },
        { x: 6, y: 0 },
      ],
    },
    {
      id: 'w3',
      points: [
        { x: 8, y: 0 },
        { x: 9, y: 0 },
      ],
    },
    {
      id: 'w4',
      points: [
        { x: 13, y: 0 },
        { x: 15, y: 0 },
      ],
    },
    {
      id: 'w5',
      points: [
        { x: 17, y: 0 },
        { x: 18, y: 0 },
      ],
    },
    {
      id: 'w6',
      points: [
        { x: 22, y: 0 },
        { x: 25, y: 0 },
      ],
    },
    {
      id: 'w7',
      points: [
        { x: 29, y: 0 },
        { x: 33, y: 0 },
      ],
    },
    // H1: de la salida de G2 al punto suma 2 (por arriba).
    {
      id: 'w8',
      points: [
        { x: 23, y: 0 },
        { x: 23, y: -3 },
        { x: 13, y: -3 },
      ],
    },
    {
      id: 'w9',
      points: [
        { x: 9, y: -3 },
        { x: 7, y: -3 },
        { x: 7, y: -1 },
      ],
    },
    // H2: de C al punto suma 3 (por arriba).
    {
      id: 'w10',
      points: [
        { x: 30, y: 0 },
        { x: 30, y: -6 },
        { x: 26, y: -6 },
      ],
    },
    {
      id: 'w11',
      points: [
        { x: 22, y: -6 },
        { x: 16, y: -6 },
        { x: 16, y: -1 },
      ],
    },
    // Lazo exterior unitario: de C al punto suma 1 (por abajo).
    {
      id: 'w12',
      points: [
        { x: 31, y: 0 },
        { x: 31, y: 3 },
        { x: 3, y: 3 },
        { x: 3, y: 1 },
      ],
    },
  ],
};

/**
 * Kuo, 7.ª ed., sec. 3-9, figura 3-17: flujograma equivalente del diagrama de bloques con dos
 * trayectorias directas (G1G2G3 y G1G4). Y/R = (G1G2G3 + G1G4)/Δ con
 * Δ = 1 + G1G2H1 + G2G3H2 + G1G2G3 + G4H2 + G1G4 (ec. 3-65 y 3-66).
 */
export const KUO_FIG_3_17_BRANCHES = [
  { from: 'R', to: 'E', gain: '1' },
  { from: 'Y', to: 'E', gain: '-1' },
  { from: 'E', to: 'X1', gain: '1' },
  { from: 'X4', to: 'X1', gain: '-H1' },
  { from: 'X1', to: 'X2', gain: 'G1' },
  { from: 'X2', to: 'X3', gain: '1' },
  { from: 'Y', to: 'X3', gain: '-H2' },
  { from: 'X3', to: 'X4', gain: 'G2' },
  { from: 'X4', to: 'Y', gain: 'G3' },
  { from: 'X3', to: 'Y', gain: 'G4' },
];

/**
 * Kuo, 7.ª ed., sec. 3-4, ec. (3-42) y figura 3-8(d): y2 = a12y1 + a32y3, y3 = a23y2 + a43y4,
 * y4 = a24y2 + a34y3 + a44y4, y5 = a25y2 + a45y4.
 */
export const KUO_EC_3_42_BRANCHES = [
  { from: 'y1', to: 'y2', gain: 'a12' },
  { from: 'y3', to: 'y2', gain: 'a32' },
  { from: 'y2', to: 'y3', gain: 'a23' },
  { from: 'y4', to: 'y3', gain: 'a43' },
  { from: 'y2', to: 'y4', gain: 'a24' },
  { from: 'y3', to: 'y4', gain: 'a34' },
  { from: 'y4', to: 'y4', gain: 'a44' },
  { from: 'y2', to: 'y5', gain: 'a25' },
  { from: 'y4', to: 'y5', gain: 'a45' },
];
