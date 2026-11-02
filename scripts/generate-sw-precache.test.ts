import { implementedCalculatorIds } from '@/components/calculators/registry';
import {
  calculatorPath,
  getAllCalculatorLocations,
  getCalculatorLocation,
  subjectPath,
  getSubjects,
} from '@/lib/curriculum';
import { expectedRoutes } from './generate-sw-precache';

const routes = expectedRoutes();

describe('expectedRoutes', () => {
  it('incluye la portada, el 404 y los documentos legales', () => {
    expect(routes).toContain('/');
    expect(routes).toContain('/404/');
    expect(routes).toContain('/aviso-legal/');
    expect(routes).toContain('/privacidad/');
    expect(routes).toContain('/datos/');
    expect(routes).toContain('/cookies/');
  });

  it('incluye todas las materias y sus temas', () => {
    for (const subject of getSubjects()) {
      expect(routes).toContain(subjectPath(subject));
      for (const topic of subject.topics) {
        expect(routes).toContain(`/${subject.slug}/${topic.slug}/`);
      }
    }
  });

  it('incluye la ruta canónica de cada calculadora implementada', () => {
    for (const id of implementedCalculatorIds) {
      const location = getCalculatorLocation(id);
      expect(location).toBeDefined();
      if (location) expect(routes).toContain(calculatorPath(location));
    }
  });

  it('deja fuera las calculadoras que solo están en el roadmap', () => {
    const planned = getAllCalculatorLocations().find(
      (location) => !implementedCalculatorIds.has(location.calculator.id),
    );
    expect(planned).toBeDefined();
    if (planned) expect(routes).not.toContain(calculatorPath(planned));
  });

  it('no repite rutas y todas usan barra final', () => {
    expect(new Set(routes).size).toBe(routes.length);
    for (const route of routes) expect(route.endsWith('/')).toBe(true);
  });
});
