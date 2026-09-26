import { describe, expect, it } from 'vitest';
import { searchAlgorithms } from './algoritmos-de-busqueda';
import { sortAlgorithms } from './algoritmos-de-ordenamiento';
import { logicalEquivalence } from './equivalencia-logica';
import { formulaLatex, parseFormula } from './proposition';
import { binaryRepresentation } from './representacion-binaria';
import { numeralSystems } from './sistemas-de-numeracion';
import { truthTable } from './tablas-de-verdad';
import { argumentValidity } from './validez-de-argumentos';

// Los casos de lógica son las tablas de los conectores y las leyes y reglas de inferencia que
// enumera el programa (Unidad III): cualquier texto de lógica proposicional las trae (Muñoz,
// 1996; Tucker y Joyanes, 2000). Se verificaron a mano fila por fila. Las conversiones y las
// trazas de algoritmos se verificaron a mano; el arreglo de ordenamiento es el de la figura 2.2
// de Cormen, Leiserson, Rivest y Stein, Introduction to Algorithms, 3.ª ed. (2009).

function ok<T extends { ok: boolean }>(result: T) {
  if (!result.ok) throw new Error('se esperaba un resultado');
  return result as Extract<T, { ok: true }>;
}

describe('Lectura de proposiciones', () => {
  it('respeta la jerarquía de los conectores y los paréntesis', () => {
    const read = (text: string) => {
      const f = parseFormula(text);
      if (typeof f === 'string') throw new Error(f);
      return formulaLatex(f);
    };
    expect(read('p ∧ q ∨ r')).toBe('(p \\land q) \\lor r');
    expect(read('~p -> q v r')).toBe('\\neg p \\rightarrow (q \\lor r)');
    expect(read('p -> q -> r')).toBe('p \\rightarrow (q \\rightarrow r)');
    expect(read('p <-> q & ¬r')).toBe('p \\leftrightarrow (q \\land \\neg r)');
    expect(read('[(p → q) ∧ p] → q')).toBe('((p \\rightarrow q) \\land p) \\rightarrow q');
  });

  it('explica los errores', () => {
    expect(parseFormula('p ∧')).toBe('la proposición está incompleta');
    expect(parseFormula('(p ∨ q')).toBe('falta cerrar un paréntesis');
    expect(parseFormula('p q')).toBe('falta un conector entre dos proposiciones');
    expect(parseFormula('p # q')).toBe('no se reconoce el símbolo «#»');
  });
});

describe('Tablas de verdad', () => {
  it('el modus ponens como proposición es una tautología', () => {
    const r = ok(truthTable.solve(truthTable.example));
    expect(r.value.classification).toBe('tautologia');
    expect(r.value.column).toEqual([true, true, true, true]);
    // Columnas: p, q, p → q, (p → q) ∧ p, y la proposición completa.
    expect(r.tables[0]!.columns).toHaveLength(5);
    expect(r.tables[0]!.rows.map((row) => row['f-0'])).toEqual(['V', 'F', 'V', 'V']);
  });

  it('p → q es una contingencia: F solo en la fila V, F', () => {
    const r = ok(truthTable.solve({ formula: 'p -> q' }));
    expect(r.value.classification).toBe('contingencia');
    expect(r.value.column).toEqual([true, false, true, true]);
  });

  it('p ∧ ¬p es una contradicción (principio de no contradicción)', () => {
    expect(ok(truthTable.solve({ formula: 'p & ~p' })).value.classification).toBe('contradiccion');
  });

  it('ordena las filas de todas V a todas F con 3 variables', () => {
    const r = ok(truthTable.solve({ formula: '(p ∨ q) ∧ r' }));
    expect(r.tables[0]!.rows.map((row) => `${row['var-p']}${row['var-q']}${row['var-r']}`)).toEqual(
      ['VVV', 'VVF', 'VFV', 'VFF', 'FVV', 'FVF', 'FFV', 'FFF'],
    );
    expect(r.value.column).toEqual([true, false, true, false, true, false, false, false]);
  });
});

describe('Equivalencia lógica', () => {
  it('reconoce la ley de De Morgan', () => {
    const r = ok(logicalEquivalence.solve(logicalEquivalence.example));
    expect(r.value.equivalent).toBe(true);
    expect(r.value.law).toBe('Ley de De Morgan');
  });

  it('reconoce la ley de la implicación y la contrarrecíproca', () => {
    expect(ok(logicalEquivalence.solve({ left: '¬p ∨ q', right: 'p → q' })).value.law).toBe(
      'Ley de la implicación',
    );
    expect(ok(logicalEquivalence.solve({ left: 'p → q', right: '¬q → ¬p' })).value.law).toBe(
      'Contrarrecíproca (contraposición)',
    );
  });

  it('las variables del esquema representan proposiciones compuestas', () => {
    const r = ok(logicalEquivalence.solve({ left: '¬((a → b) ∧ c)', right: '¬(a → b) ∨ ¬c' }));
    expect(r.value.law).toBe('Ley de De Morgan');
  });

  it('p → q y q → p (la recíproca) no son equivalentes', () => {
    const r = ok(logicalEquivalence.solve({ left: 'p → q', right: 'q → p' }));
    expect(r.value.equivalent).toBe(false);
    // Filas: VV, VF, FV, FF. Difieren en VF y FV.
    expect(r.value.differentRows).toEqual([2, 3]);
  });
});

describe('Validez de un razonamiento', () => {
  it('modus tollendo tollens: válido', () => {
    const r = ok(argumentValidity.solve(argumentValidity.example));
    expect(r.value.valid).toBe(true);
    expect(r.value.form).toBe('Modus tollendo tollens');
    // Solo la fila F, F hace verdaderas a p → q y a ¬q.
    expect(r.value.criticalRows).toEqual([4]);
  });

  it('modus ponendo ponens y silogismo hipotético, con las premisas en otro orden', () => {
    expect(ok(argumentValidity.solve({ premises: 'p\np → q', conclusion: 'q' })).value.form).toBe(
      'Modus ponendo ponens',
    );
    const r = ok(argumentValidity.solve({ premises: 'q → r; p → q', conclusion: 'p → r' }));
    expect(r.value.valid).toBe(true);
    expect(r.value.form).toBe('Silogismo hipotético');
  });

  it('afirmación del consecuente: no válido, contraejemplo p = F, q = V', () => {
    const r = ok(argumentValidity.solve({ premises: 'p → q\nq', conclusion: 'p' }));
    expect(r.value.valid).toBe(false);
    expect(r.value.form).toBe('Falacia de afirmación del consecuente');
    expect(r.value.counterexamples).toEqual([3]);
  });
});

describe('Sistemas de numeración', () => {
  it('25.375 en base 10 es 11001.011 en base 2', () => {
    const r = ok(numeralSystems.solve(numeralSystems.example));
    expect(r.value.result).toBe('11001.011');
    expect(r.value.exactDecimal).toBe('203/8');
    // Residuos de 25, 12, 6, 3, 1 entre 2: 1, 0, 0, 1, 1.
    expect(r.tables[0]!.rows.map((row) => row.remainder)).toEqual(['1', '0', '0', '1', '1']);
    expect(r.tables[1]!.rows.map((row) => row.digit)).toEqual(['0', '1', '1']);
  });

  it('pasa de hexadecimal y octal a decimal', () => {
    expect(ok(numeralSystems.solve({ number: 'FF', from: 16, to: 10 })).value.result).toBe('255');
    expect(ok(numeralSystems.solve({ number: '777', from: 8, to: 10 })).value.result).toBe('511');
    expect(ok(numeralSystems.solve({ number: '-1A.8', from: 16, to: 10 })).value.result).toBe(
      '-26.5',
    );
  });

  it('usa el atajo de agrupar bits entre las bases 2 y 16', () => {
    const r = ok(numeralSystems.solve({ number: '11010110.1', from: 2, to: 16 }));
    expect(r.value.result).toBe('D6.8');
    expect(r.steps.some((s) => s.title === 'Atajo: grupos de 4 bits')).toBe(true);
  });

  it('0.1 en base 2 es periódico: 0.0(0011)', () => {
    const r = ok(numeralSystems.solve({ number: '0.1', from: 10, to: 2 }));
    expect(r.value.periodic).toBe(true);
    expect(r.value.result).toBe('0.00011');
    expect(r.summary[0]!.value).toBe('0.0\\overline{0011}_{2}');
  });

  it('rechaza dígitos que no son de la base', () => {
    expect(numeralSystems.inputSchema.safeParse({ number: '129', from: 8, to: 2 }).success).toBe(
      false,
    );
  });
});

describe('Representación binaria de enteros', () => {
  it('−25 con 8 bits', () => {
    const { value } = ok(binaryRepresentation.solve(binaryRepresentation.example));
    expect(value.signMagnitude).toBe('10011001');
    expect(value.onesComplement).toBe('11100110');
    expect(value.twosComplement).toBe('11100111');
    // Exceso 128: −25 + 128 = 103 = 01100111.
    expect(value.excess).toBe('01100111');
  });

  it('−128 con 8 bits solo existe en complemento a 2 y en exceso', () => {
    const { value } = ok(binaryRepresentation.solve({ value: -128, bits: 8 }));
    expect(value.signMagnitude).toBeNull();
    expect(value.onesComplement).toBeNull();
    expect(value.twosComplement).toBe('10000000');
    expect(value.excess).toBe('00000000');
  });

  it('los positivos coinciden en las tres primeras representaciones', () => {
    const { value } = ok(binaryRepresentation.solve({ value: 5, bits: 4 }));
    expect([value.signMagnitude, value.onesComplement, value.twosComplement]).toEqual([
      '0101',
      '0101',
      '0101',
    ]);
    expect(value.excess).toBe('1101');
  });

  it('rechaza valores fuera de rango', () => {
    expect(binaryRepresentation.solve({ value: 128, bits: 8 }).ok).toBe(false);
  });
});

describe('Algoritmos de búsqueda', () => {
  // Búsqueda binaria de 23: c = 5 (16), c = 8 (56), c = 6 (23).
  it('búsqueda binaria: encuentra 23 en la posición 6 en 3 iteraciones', () => {
    const r = ok(searchAlgorithms.solve(searchAlgorithms.example));
    expect(r.value).toEqual({ found: true, position: 6, comparisons: 3 });
    expect(r.tables[0]!.rows.map((row) => row.center)).toEqual([5, 8, 6]);
  });

  it('búsqueda secuencial: recorre hasta encontrarlo o agotar la lista', () => {
    const list = '7 3 9 1 5';
    expect(ok(searchAlgorithms.solve({ list, target: 1, method: 'secuencial' })).value).toEqual({
      found: true,
      position: 4,
      comparisons: 4,
    });
    expect(ok(searchAlgorithms.solve({ list, target: 8, method: 'secuencial' })).value).toEqual({
      found: false,
      position: null,
      comparisons: 5,
    });
  });

  it('la búsqueda binaria exige una lista ordenada', () => {
    const r = searchAlgorithms.solve({ list: '7 3 9', target: 3, method: 'binaria' });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('not-sorted');
  });
});

describe('Algoritmos de ordenamiento', () => {
  // Cormen et al., fig. 2.2: inserción sobre ⟨5, 2, 4, 6, 1, 3⟩.
  it('inserción: los estados de la figura 2.2 de Cormen', () => {
    const { value } = ok(
      sortAlgorithms.solve({ list: '5 2 4 6 1 3', method: 'insercion', order: 'ascendente' }),
    );
    expect(value.states).toEqual([
      [2, 5, 4, 6, 1, 3],
      [2, 4, 5, 6, 1, 3],
      [2, 4, 5, 6, 1, 3],
      [1, 2, 4, 5, 6, 3],
      [1, 2, 3, 4, 5, 6],
    ]);
    // 9 desplazamientos = 9 inversiones del arreglo.
    expect(value.moves).toBe(9);
  });

  // Burbuja: pasadas con 4, 2, 2, 1 y 0 intercambios (9 = número de inversiones).
  it('burbuja: 15 comparaciones y 9 intercambios', () => {
    const { value } = ok(sortAlgorithms.solve(sortAlgorithms.example));
    expect(value).toMatchObject({
      sorted: [1, 2, 3, 4, 5, 6],
      comparisons: 15,
      moves: 9,
      passes: 5,
    });
    expect(value.states[0]).toEqual([2, 4, 5, 1, 3, 6]);
  });

  it('burbuja se detiene si una pasada no intercambia nada', () => {
    const { value } = ok(
      sortAlgorithms.solve({ list: '1 2 3 4', method: 'burbuja', order: 'ascendente' }),
    );
    expect(value.passes).toBe(1);
    expect(value.comparisons).toBe(3);
  });

  // Selección: intercambios en las pasadas 1 (5↔1), 3 (4↔3) y 4 (6↔4).
  it('selección: 15 comparaciones y 3 intercambios', () => {
    const { value } = ok(
      sortAlgorithms.solve({ list: '5 2 4 6 1 3', method: 'seleccion', order: 'ascendente' }),
    );
    expect(value.comparisons).toBe(15);
    expect(value.moves).toBe(3);
  });

  it('ordena en forma descendente', () => {
    const { value } = ok(
      sortAlgorithms.solve({ list: '5 2 4 6 1 3', method: 'seleccion', order: 'descendente' }),
    );
    expect(value.sorted).toEqual([6, 5, 4, 3, 2, 1]);
  });
});
