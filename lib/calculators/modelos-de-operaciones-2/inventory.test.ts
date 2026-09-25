import { describe, expect, it } from 'vitest';
import { discounts } from './descuentos-por-cantidad';
import { eoq } from './eoq';
import { eoqShortages } from './eoq-con-faltantes';
import { singlePeriod } from './modelo-de-un-periodo';
import { reorder } from './punto-de-reorden';

// Fuentes:
// - Taha, Operations Research: An Introduction. Datos verificados con el «R Textbook Companion»
//   de la 9.ª ed. (FOSSEE, 2020): ejemplo 12.3-1 (lámparas de neón: D = 100/día, K = $100,
//   h = $0.02, L = 12 días), 12.3-2 (aceite de LubeCar: D = 187.5 gal/día, K = $20, h = $0.02,
//   $3 por galón o $2.50 desde 1000 galones) y 14.1-1 (demanda diaria normal μ = 100, σ = 10,
//   L = 2 días, α = 0.05).
// - Hillier & Lieberman, Introduction to Operations Research, 7.ª ed. en inglés (2001), cap. 19:
//   bocinas para televisores (sec. 19.3 y 19.5) y bicicletas (sec. 19.6).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('EOQ', () => {
  // Taha: y* = √(2·100·100/0.02) = 1000 lámparas, t₀ = 10 días; como L = 12 > t₀, el tiempo de
  // entrega efectivo es 12 − 10 = 2 días y se pide cuando quedan 2 × 100 = 200 lámparas; el costo
  // diario es 100·100/1000 + 0.02·1000/2 = $20.
  it('Taha, lámparas de neón: Q* = 1000, R = 200, TCU = 20', () => {
    const { value } = ok(eoq.solve(eoq.example));
    expect(value.quantity).toBeCloseTo(1000, 9);
    expect(value.cycle).toBeCloseTo(10, 9);
    expect(value.reorder!.fullCycles).toBe(1);
    expect(value.reorder!.effectiveLeadTime).toBeCloseTo(2, 9);
    expect(value.reorder!.reorderPoint).toBeCloseTo(200, 9);
    expect(value.totalCost).toBeCloseTo(20, 9);
    expect(value.orderingCost).toBeCloseTo(value.holdingCost, 12);
  });

  // Hillier, sec. 19.3: Q* = √(2·8000·12000/0.30) = 25,298 bocinas cada t* = 3.2 meses.
  it('Hillier, bocinas: Q* = 25,298 y t* = 3.2 meses', () => {
    const { value } = ok(eoq.solve({ demand: 8000, orderCost: 12000, holdingCost: 0.3 }));
    expect(value.quantity).toBeCloseTo(25298, 0);
    expect(value.cycle).toBeCloseTo(3.2, 1);
    expect(value.reorder).toBeNull();
  });

  // Caso borde analítico: L menor que un ciclo → R = L·D sin ajuste; L = 2t₀ exacto → R = 0.
  it('punto de reorden sin ajuste y con L múltiplo del ciclo', () => {
    expect(ok(eoq.solve({ ...eoq.example, leadTime: 4 })).value.reorder!.reorderPoint).toBeCloseTo(
      400,
      9,
    );
    expect(ok(eoq.solve({ ...eoq.example, leadTime: 20 })).value.reorder!.reorderPoint).toBeCloseTo(
      0,
      9,
    );
  });

  it('los datos deben ser positivos', () => {
    expect(eoq.inputSchema.safeParse({ ...eoq.example, holdingCost: 0 }).success).toBe(false);
  });
});

describe('EOQ con faltantes planeados', () => {
  // Hillier, sec. 19.3: S* = 22,424, Q* = 28,540, t* = 3.6 meses y faltante máximo de 6,116.
  it('Hillier, bocinas con p = $1.10', () => {
    const { value } = ok(eoqShortages.solve(eoqShortages.example));
    expect(value.maxInventory).toBeCloseTo(22424, 0);
    expect(value.quantity).toBeCloseTo(28540, 0);
    expect(value.cycle).toBeCloseTo(3.6, 1);
    expect(value.maxShortage).toBeCloseTo(6116, 0);
    expect(value.classicQuantity).toBeCloseTo(25298, 0);
  });

  // Caso borde analítico: el costo mínimo es √(2KDh) √(p/(p+h)), menor que el del EOQ clásico;
  // y con p muy grande Q* tiende al EOQ.
  it('costo óptimo analítico y límite p → ∞', () => {
    const { demand: D, orderCost: K, holdingCost: h, shortageCost: p } = eoqShortages.example;
    const { value } = ok(eoqShortages.solve(eoqShortages.example));
    expect(value.totalCost).toBeCloseTo(Math.sqrt(2 * K * D * h) * Math.sqrt(p / (p + h)), 6);
    const large = ok(eoqShortages.solve({ ...eoqShortages.example, shortageCost: 1e9 })).value;
    expect(large.quantity).toBeCloseTo(large.classicQuantity, 2);
  });
});

describe('EOQ con descuentos por cantidad', () => {
  // Hillier, sec. 19.3: Q* = 25,298 cae en el rango de $10; T₂(25,298) = $87,589 y
  // T₃(80,000) = $89,200, así que conviene producir 25,298. El nivel de $11 se descarta.
  it('Hillier, bocinas: Q = 25,298 con T = 87,589', () => {
    const { value } = ok(discounts.solve(discounts.example));
    const [t1, t2, t3] = value.candidates;
    expect(t1!.quantity).toBeNull();
    expect(t2!.quantity).toBeCloseTo(25298, 0);
    expect(t2!.totalCost).toBeCloseTo(87589, 0);
    expect(t3!.quantity).toBe(80000);
    expect(t3!.totalCost).toBeCloseTo(89200, 6);
    expect(value.tier).toBe(1);
    expect(value.quantity).toBeCloseTo(25298, 0);
  });

  // Hillier: con $9 por encima de 80,000, T₃(80,000) = $85,200 y el óptimo pasa a 80,000.
  it('Hillier, variante con $9: Q = 80,000 con T = 85,200', () => {
    const tiers = discounts.example.tiers.map((t, j) => (j === 2 ? { ...t, unitPrice: 9 } : t));
    const { value } = ok(discounts.solve({ ...discounts.example, tiers }));
    expect(value.quantity).toBe(80000);
    expect(value.totalCost).toBeCloseTo(85200, 6);
  });

  // Taha, ejemplo 12.3-2: y_m = √(2·20·187.5/0.02) = 612.37 galones está por debajo del punto de
  // descuento q = 1000, y la política óptima es pedir 1000 galones. Con L = 2 días se pide cuando
  // quedan 2 × 187.5 = 375 galones.
  it('Taha, aceite de LubeCar: pedir 1000 galones', () => {
    const { value } = ok(
      discounts.solve({
        demand: 187.5,
        orderCost: 20,
        holdingType: 'fijo',
        holding: 0.02,
        tiers: [
          { minQuantity: 0, unitPrice: 3 },
          { minQuantity: 1000, unitPrice: 2.5 },
        ],
        leadTime: 2,
      }),
    );
    expect(value.candidates[0]!.eoq).toBeCloseTo(612.37, 2);
    expect(value.quantity).toBe(1000);
    expect(value.reorder!.reorderPoint).toBeCloseTo(375, 9);
  });

  // Caso borde analítico: con h = I·c cada nivel tiene su propio Q*.
  it('costo de mantener como porcentaje del precio', () => {
    const { value } = ok(
      discounts.solve({ ...discounts.example, holdingType: 'porcentaje', holding: 3 }),
    );
    expect(value.candidates[1]!.holding).toBeCloseTo(0.3, 12);
    expect(value.candidates[0]!.eoq).toBeCloseTo(Math.sqrt((2 * 12000 * 8000) / 0.33), 6);
  });

  it('valida los niveles de precio', () => {
    const parse = (tiers: { minQuantity: number; unitPrice: number }[]) =>
      discounts.inputSchema.safeParse({ ...discounts.example, tiers }).success;
    expect(parse([{ minQuantity: 5, unitPrice: 3 }])).toBe(false);
    expect(
      parse([
        { minQuantity: 0, unitPrice: 3 },
        { minQuantity: 100, unitPrice: 4 },
      ]),
    ).toBe(false);
    expect(
      parse([
        { minQuantity: 0, unitPrice: 3 },
        { minQuantity: 0, unitPrice: 2 },
      ]),
    ).toBe(false);
  });
});

describe('Punto de reorden y stock de seguridad', () => {
  // Taha, ejemplo 14.1-1: σ_L = √2 · 10 = 14.14 y B = 14.14 × 1.645 = 23.26 lámparas.
  it('Taha, ejemplo 14.1-1: B = 23.26', () => {
    const { value } = ok(reorder.solve(reorder.example));
    expect(value.leadDemandMean).toBe(200);
    expect(value.leadDemandSd).toBeCloseTo(14.14, 2);
    expect(value.z).toBeCloseTo(1.645, 3);
    expect(value.safetyStock).toBeCloseTo(23.26, 2);
    expect(value.reorderPoint).toBeCloseTo(223.26, 2);
  });

  // Hillier, sec. 19.5: μ = 8,000, σ = 2,000 y nivel 0.95 → R = 8,000 + 1.645(2,000) = 11,290 y
  // stock de seguridad de 3,290 (con z de la tabla; con z exacto, 11,289.7).
  it('Hillier, bocinas: R = 11,290 y stock de seguridad 3,290', () => {
    const { value } = ok(
      reorder.solve({
        mode: 'tiempo-de-entrega',
        leadDemandMean: 8000,
        leadDemandSd: 2000,
        serviceLevel: 0.95,
      }),
    );
    expect(value.reorderPoint).toBeCloseTo(11290, -1);
    expect(value.safetyStock).toBeCloseTo(3290, -1);
  });

  it('pide los datos del modo elegido', () => {
    expect(
      reorder.inputSchema.safeParse({ mode: 'tiempo-de-entrega', serviceLevel: 0.9 }).success,
    ).toBe(false);
    expect(reorder.inputSchema.safeParse({ ...reorder.example, serviceLevel: 95 }).success).toBe(
      false,
    );
  });
});

describe('Modelo de un periodo', () => {
  // Hillier, sec. 19.6: c = 20, p = 45, h = −9 (1 de guardar − 10 de rescate); demanda
  // exponencial con media 10,000 → F(y₀) = 25/36 = 0.69444 e y₀ = 11,856. Con 500 bicicletas
  // en inventario se piden 11,356.
  it('Hillier, bicicletas: y* = 11,856', () => {
    const { value } = ok(singlePeriod.solve(singlePeriod.example));
    expect(value.underage).toBe(25);
    expect(value.overage).toBe(11);
    expect(value.criticalRatio).toBeCloseTo(0.69444, 5);
    expect(value.optimalLevel).toBeCloseTo(11856, 0);
  });

  it('Hillier, con 500 en inventario se piden 11,356', () => {
    const { value } = ok(singlePeriod.solve({ ...singlePeriod.example, initialStock: 500 }));
    expect(value.orderQuantity).toBeCloseTo(11356, 0);
    const none = ok(singlePeriod.solve({ ...singlePeriod.example, initialStock: 12000 })).value;
    expect(none.orderQuantity).toBe(0);
  });

  // Casos borde analíticos: uniforme → a + RC(b − a); normal con RC = 0.5 → la media.
  it('demanda uniforme y normal', () => {
    const base = { price: 10, cost: 6, salvage: 2, holdingCost: 0, shortageCost: 0 };
    // C_u = 4, C_o = 4 → RC = 0.5.
    const uniform = ok(
      singlePeriod.solve({ ...base, distribution: 'uniforme', min: 100, max: 200 }),
    ).value;
    expect(uniform.optimalLevel).toBeCloseTo(150, 9);
    const normal = ok(
      singlePeriod.solve({ ...base, distribution: 'normal', mean: 300, sd: 20 }),
    ).value;
    expect(normal.optimalLevel).toBeCloseTo(300, 9);
  });

  it('costos inválidos → invalid-costs, con la traza de C_u y C_o', () => {
    const result = singlePeriod.solve({ ...singlePeriod.example, price: 15 });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('invalid-costs');
    expect(result.steps).toHaveLength(1);
  });

  it('pide los parámetros de la distribución elegida', () => {
    const parse = (patch: object) =>
      singlePeriod.inputSchema.safeParse({ ...singlePeriod.example, ...patch }).success;
    expect(parse({ distribution: 'normal', mean: 100 })).toBe(false);
    expect(parse({ distribution: 'uniforme', min: 10, max: 5 })).toBe(false);
    expect(parse({ mean: -1 })).toBe(false);
  });
});
