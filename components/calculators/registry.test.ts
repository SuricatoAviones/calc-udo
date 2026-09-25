import { expect, it } from 'vitest';
import { getCalculatorLocation } from '@/lib/curriculum';
import { calculatorRegistry } from './registry';

it('todo id registrado existe en data/curriculum.ts', () => {
  for (const id of Object.keys(calculatorRegistry)) {
    expect(getCalculatorLocation(id), id).toBeDefined();
  }
});
