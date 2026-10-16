import { describe, expect, it } from 'vitest';
import { diagramasDeBode } from './diagramas-de-bode';

function ok(openLoop: string) {
  const r = diagramasDeBode.solve({ openLoop });
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('diagramas de Bode', () => {
  it('el ejemplo cumple el schema', () => {
    expect(diagramasDeBode.inputSchema.safeParse(diagramasDeBode.example).success).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 8-1: G(jω) = 10(jω + 3)/[jω(jω + 2)((jω)² + jω + 2)] =
  // 7.5(jω/3 + 1)/[jω(jω/2 + 1)((jω)²/2 + jω/2 + 1)]. Esquinas en √2 (cuadrática, ζ = 0.3536), 2 y 3;
  // pendientes −20 dB/déc hasta √2, −60 hasta 2, −80 hasta 3 y −60 después.
  it('Ogata, ejemplo 8-1: forma de Bode y frecuencias de esquina', () => {
    const r = ok('10(s + 3)/(s(s + 2)(s^2 + s + 2))');
    expect(r.value.gain).toBeCloseTo(7.5, 10);
    const [origin, quad, first, zero] = r.value.factors;
    expect(origin).toMatchObject({ kind: 'origen', zero: false, multiplicity: 1 });
    expect(quad!.kind).toBe('cuadratico');
    expect(quad!.corner).toBeCloseTo(Math.SQRT2, 10);
    expect(quad!.zeta).toBeCloseTo(0.3536, 4);
    expect(first).toMatchObject({ kind: 'primer-orden', zero: false });
    expect(first!.corner).toBeCloseTo(2, 10);
    expect(zero).toMatchObject({ kind: 'primer-orden', zero: true });
    expect(zero!.corner).toBeCloseTo(3, 10);
    const slopes = JSON.stringify(r.steps.find((s) => s.title === 'Curva asintótica de magnitud'));
    expect(slopes).toContain('queda en -60 dB/década');
    expect(slopes).toContain('queda en -80 dB/década');
  });

  // Ogata, 5.ª ed. en español, ejemplo 7-21 (MATLAB, margin): G(s) = 20(s + 1)/[s(s + 5)(s² + 2s + 10)]:
  // margen de ganancia 9.9293 dB, margen de fase 103.6573°, cruce de fase 4.0131 rad/s y cruce de
  // ganancia 0.4426 rad/s.
  it('Ogata 5.ª ed., ejemplo 7-21: márgenes de ganancia y de fase', () => {
    const r = ok('20(s + 1)/(s(s + 5)(s^2 + 2s + 10))');
    expect(r.value.gainMarginDb).toBeCloseTo(9.9293, 4);
    expect(r.value.phaseMargin).toBeCloseTo(103.6573, 3);
    expect(r.value.phaseCrossover).toBeCloseTo(4.0131, 4);
    expect(r.value.gainCrossover).toBeCloseTo(0.4426, 4);
  });

  // Ogata, 3.ª ed., ejemplo 8-20: K/[s(s + 1)(s + 5)]. El libro lee de las trazas asintóticas
  // MF = 21° y MG = 8 dB con K = 10, y MF = −30° y MG = −12 dB con K = 100. Los valores exactos se
  // verifican a mano: la fase vale −180° en ω = √5, donde |G| = K/30, así que MG = 20 log(30/K)
  // (9.54 dB y −10.46 dB); los márgenes de fase exactos son 25.4° y −23.7°.
  it('Ogata, ejemplo 8-20: estable con K = 10 e inestable con K = 100', () => {
    const k10 = ok('10/(s(s + 1)(s + 5))');
    expect(k10.value.phaseCrossover).toBeCloseTo(Math.sqrt(5), 8);
    expect(k10.value.gainMarginDb).toBeCloseTo(20 * Math.log10(3), 8);
    expect(k10.value.phaseMargin).toBeCloseTo(25.4, 1);
    expect(k10.value.phaseMargin!).toBeGreaterThan(0);
    const k100 = ok('100/(s(s + 1)(s + 5))');
    expect(k100.value.gainMarginDb).toBeCloseTo(20 * Math.log10(0.3), 8);
    expect(k100.value.phaseMargin).toBeCloseTo(-23.7, 1);
    expect(k100.value.closed).toBeNull();
  });

  // Ogata, 3.ª ed., ec. (8-6) y (8-7): para el segundo orden ω_n²/(s² + 2ζω_ns + ω_n²) con
  // ζ ≤ 0.707, ω_r = ω_n√(1 − 2ζ²) y M_r = 1/(2ζ√(1 − ζ²)). G(s) = 1/[s(s + 1)] con
  // realimentación unitaria da ω_n = 1 y ζ = 0.5: ω_r = 0.7071, M_r = 1.1547. El ancho de banda
  // de ese sistema, ω_n√(1 − 2ζ² + √(4ζ⁴ − 4ζ² + 2)) = 1.2720, se verificó resolviendo |M| = 1/√2.
  it('Ogata, ec. 8-6 y 8-7: pico de resonancia y ancho de banda', () => {
    const r = ok('1/(s(s + 1))');
    expect(r.value.closed!.peakFrequency).toBeCloseTo(Math.SQRT1_2, 6);
    expect(r.value.closed!.peak).toBeCloseTo(1 / (2 * 0.5 * Math.sqrt(0.75)), 6);
    expect(r.value.closed!.bandwidth).toBeCloseTo(1.272, 3);
    expect(r.value.gainMarginDb).toBeNull();
  });

  it('las gráficas usan escala logarítmica en ω', () => {
    const r = ok('10/(s + 1)');
    expect(r.series.map((s) => s.xScale)).toEqual(['log', 'log']);
  });

  it('errores', () => {
    const bad = diagramasDeBode.solve({ openLoop: 's^^2' });
    expect(!bad.ok && bad.error.code).toBe('funcion-invalida');
    const axis = diagramasDeBode.solve({ openLoop: '1/(s^2 + 4)' });
    expect(!axis.ok && axis.error.code).toBe('raices-en-eje-imaginario');
  });
});
