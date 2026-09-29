import { describe, expect, it } from 'vitest';
import { getAllCalculatorLocations } from './curriculum';
import { buildSearchIndex, normalizeText, searchCalculators } from './search';

// El buscador no calcula nada: los casos se verifican contra los títulos del currículum
// (data/curriculum.ts). Para no depender del registro de UI (lib/ no importa componentes), aquí
// todas las calculadoras cuentan como implementadas salvo dos de Estadísticas II.
const pendingIds = new Set(['regresion-lineal', 'pruebas-no-parametricas']);
const implementedCalculatorIds = new Set(
  getAllCalculatorLocations()
    .map((l) => l.calculator.id)
    .filter((id) => !pendingIds.has(id)),
);
const index = buildSearchIndex(implementedCalculatorIds);
const ids = (query: string, limit?: number) =>
  searchCalculators(index, query, limit).map((r) => r.entry.id);

describe('normalizeText', () => {
  it('quita tildes, mayúsculas y signos', () => {
    expect(normalizeText('Distribución de Poisson')).toBe('distribucion de poisson');
    expect(normalizeText('Método húngaro')).toBe('metodo hungaro');
    expect(normalizeText('Modelo M/M/1')).toBe('modelo m m 1');
    expect(normalizeText('  Año  ')).toBe('ano');
  });
});

describe('buildSearchIndex', () => {
  it('incluye cada calculadora una vez, con URL solo si está implementada', () => {
    const idsInIndex = index.map((e) => e.id);
    expect(new Set(idsInIndex).size).toBe(idsInIndex.length);
    const poisson = index.find((e) => e.id === 'distribucion-de-poisson')!;
    expect(poisson.path).toBe('/estadistica-1/distribuciones-discretas/distribucion-de-poisson/');
    expect(poisson.subject).toBe('Estadísticas I');
    const pending = index.filter((e) => !implementedCalculatorIds.has(e.id));
    expect(pending.every((e) => e.path === null)).toBe(true);
  });
});

describe('searchCalculators', () => {
  it('encuentra por título sin importar tildes ni mayúsculas', () => {
    expect(ids('poisson')[0]).toBe('distribucion-de-poisson');
    expect(ids('DISTRIBUCION NORMAL')[0]).toBe('distribucion-normal');
    expect(ids('hungaro')[0]).toBe('metodo-hungaro');
  });

  it('todas las palabras deben aparecer', () => {
    // El tema «Método dual simplex y análisis de sensibilidad» también contiene ambas palabras,
    // pero el título que las tiene va primero.
    expect(ids('simplex dual')[0]).toBe('dual-simplex');
    expect(ids('simplex')).toEqual(
      expect.arrayContaining(['simplex', 'simplex-algebraico', 'dual-simplex']),
    );
    expect(ids('poisson simplex')).toEqual([]);
  });

  // La descripción del tema de las discretas nombra todas las distribuciones; con «poisson» no
  // deben aparecer la binomial ni la geométrica, y con «metodo hungaro» solo el método húngaro.
  it('descarta coincidencias que solo están en la descripción del tema', () => {
    expect(ids('poisson', 20)).not.toContain('distribucion-binomial');
    expect(ids('poisson', 20)).not.toContain('distribucion-geometrica');
    expect(ids('metodo hungaro', 20)).toEqual(['metodo-hungaro']);
  });

  it('encuentra siglas y términos del tema', () => {
    expect(ids('mm1')).toContain('cola-mm1');
    expect(ids('eoq')[0]).toBe('eoq');
    // «holgura» no está en ningún título, pero sí en el resumen de la forma estándar.
    expect(ids('holguras')).toContain('forma-estandar');
  });

  it('pone primero las implementadas y marca las pendientes', () => {
    const results = searchCalculators(index, 'regresion', 20);
    const firstPending = results.findIndex((r) => r.entry.path === null);
    const lastImplemented = results.map((r) => r.entry.path !== null).lastIndexOf(true);
    expect(firstPending === -1 || lastImplemented < firstPending).toBe(true);
    expect(results.some((r) => r.entry.id === 'regresion-lineal' && r.entry.path === null)).toBe(
      true,
    );
  });

  it('consulta vacía y límite', () => {
    expect(ids('   ')).toEqual([]);
    expect(ids('distribucion', 3)).toHaveLength(3);
  });
});
