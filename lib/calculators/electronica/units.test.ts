import { describe, expect, it } from 'vitest';
import { engTex, engText, parallel, parseQuantity } from './units';

// Pruebas de formato y lectura de magnitudes: no hay valores de libro; se verifican las
// conversiones de prefijos del SI.
describe('magnitudes con prefijo de ingeniería', () => {
  it('lee prefijos, unidades, coma decimal y notación científica', () => {
    expect(parseQuantity('2.2k')).toBeCloseTo(2200, 10);
    expect(parseQuantity('2,2 kΩ')).toBeCloseTo(2200, 10);
    expect(parseQuantity('100µF')).toBe(1e-4);
    expect(parseQuantity('100u')).toBe(1e-4);
    expect(parseQuantity('47 nF')).toBe(4.7e-8);
    expect(parseQuantity('1e-6')).toBe(1e-6);
    expect(parseQuantity('−0.3 mA')).toBeCloseTo(-3e-4, 15);
    expect(parseQuantity('2.2M')).toBeCloseTo(2.2e6, 6);
    expect(parseQuantity('20 µS')).toBeCloseTo(2e-5, 15);
    expect(parseQuantity('60 Hz')).toBe(60);
    expect(parseQuantity('120')).toBe(120);
  });

  it('rechaza texto inválido', () => {
    expect(parseQuantity('')).toBeNaN();
    expect(parseQuantity('abc')).toBeNaN();
    expect(parseQuantity('1e3k')).toBeNaN();
    expect(parseQuantity('2.2x')).toBeNaN();
  });

  it('formatea con prefijo', () => {
    expect(engText(0.0186, 'A')).toBe('18.6 mA');
    expect(engText(2200, 'Ω')).toBe('2.2 kΩ');
    expect(engTex(4.708e-5, 'A')).toBe('47.08\\ \\mu\\text{A}');
    expect(engTex(2200, 'Ω')).toBe('2.2\\ \\text{k}\\Omega');
  });

  it('calcula resistencias en paralelo', () => {
    expect(parallel(3e3, 6e3)).toBeCloseTo(2e3, 10);
    expect(parallel(1e3, Infinity)).toBe(1e3);
    expect(parallel(0, 1e3)).toBe(0);
  });
});
