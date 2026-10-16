import { describe, expect, it } from 'vitest';
import { sintonizacionPid, type PidInput } from './sintonizacion-pid';

const solve = (input: Partial<PidInput>) =>
  sintonizacionPid.solve({ ...sintonizacionPid.example, ...input });
function ok(input: Partial<PidInput>) {
  const r = solve(input);
  if (!r.ok) throw new Error(r.error.message);
  return r;
}

describe('sintonizado de controladores PID', () => {
  it('el ejemplo cumple el schema', () => {
    expect(sintonizacionPid.inputSchema.safeParse(sintonizacionPid.example).success).toBe(true);
  });

  // Ogata, 3.ª ed., ejemplo 10-1: planta 1/[s(s + 1)(s + 5)]. Con Routh, Kcr = 30; con s = jω,
  // ω² = 5 y Pcr = 2π/√5 = 2.8099. Kp = 18, Ti = 1.405, Td = 0.35124 y
  // Gc(s) = 6.3223(s + 1.4235)²/s. En lazo cerrado,
  // C/R = (6.3223s² + 18s + 12.811)/(s⁴ + 6s³ + 11.3223s² + 18s + 12.811), con un sobrepaso de
  // aproximadamente 62 %.
  it('Ogata, ejemplo 10-1: segundo método con la planta', () => {
    const r = ok({});
    expect(r.value.criticalGain).toBeCloseTo(30, 8);
    expect(r.value.criticalPeriod).toBeCloseTo(2.8099, 4);
    expect(r.value.settings.kp).toBeCloseTo(18, 8);
    expect(r.value.settings.ti).toBeCloseTo(1.405, 3);
    expect(r.value.settings.td).toBeCloseTo(0.35124, 5);
    const [a, b, c] = r.value.controller.num;
    expect(a).toBeCloseTo(6.3223, 4);
    expect(b).toBeCloseTo(18, 8);
    // El libro redondea Ti a 1.405: 18/1.405 = 12.811; con Ti = π/√5 exacto es 12.8117.
    expect(c).toBeCloseTo(12.811, 2);
    // Cero doble en −4/Pcr = −1.4235.
    expect(-b! / (2 * a!)).toBeCloseTo(-1.4235, 4);
    const den = r.value.closedLoop!.den;
    expect(den[0]).toBeCloseTo(1, 10);
    expect(den[1]).toBeCloseTo(6, 10);
    expect(den[2]).toBeCloseTo(11.3223, 4);
    expect(den[3]).toBeCloseTo(18, 8);
    expect(den[4]).toBeCloseTo(12.811, 2);
    expect(r.value.overshoot).toBeCloseTo(0.62, 2);
  });

  // Ogata, tabla 10-2 con los valores críticos del ejemplo 10-1 (Kcr = 30, Pcr = 2.8099).
  it('Ogata, tabla 10-2: P, PI y PID', () => {
    const r = ok({ method: 'oscilacion', controller: 'PI' });
    expect(r.value.table.P.kp).toBeCloseTo(15, 10);
    expect(r.value.table.PI.kp).toBeCloseTo(13.5, 10);
    expect(r.value.table.PI.ti).toBeCloseTo(2.8099 / 1.2, 10);
    expect(r.value.table.PID.td).toBeCloseTo(0.125 * 2.8099, 10);
    expect(r.value.controller).toEqual({ num: [13.5, 13.5 / (2.8099 / 1.2)], den: [1, 0] });
  });

  // Ogata, tabla 10-1 (primer método): Kp = 1.2T/L, Ti = 2L, Td = 0.5L y el PID es
  // 0.6T(s + 1/L)²/s. Con L = 1 y T = 10 (valores elegidos aquí): Kp = 12, Ti = 2, Td = 0.5 y
  // Gc = (6s² + 12s + 6)/s = 6(s + 1)²/s.
  it('Ogata, tabla 10-1: primer método', () => {
    const r = ok({ method: 'curva', controller: 'PID', delay: 1, timeConstant: 10 });
    expect(r.value.settings).toEqual({ kp: 12, ti: 2, td: 0.5 });
    expect(r.value.controller).toEqual({ num: [6, 12, 6], den: [1, 0] });
    expect(r.value.table.P.kp).toBeCloseTo(10, 10);
    expect(r.value.table.PI.ti).toBeCloseTo(1 / 0.3, 10);
  });

  // Ogata, sec. 10-2: con la planta (s + 2)(s + 3)/[s(s + 1)(s + 5)] la primera columna del arreglo
  // es positiva para todo Kp > 0: no hay oscilación sostenida y el segundo método no se aplica.
  it('Ogata, sec. 10-2: planta sin ganancia crítica', () => {
    const r = solve({ plant: '(s + 2)(s + 3)/(s(s + 1)(s + 5))' });
    expect(!r.ok && r.error.code).toBe('sin-ganancia-critica');
  });

  it('errores de la planta', () => {
    const r = solve({ plant: 's^^2' });
    expect(!r.ok && r.error.code).toBe('funcion-invalida');
  });
});
