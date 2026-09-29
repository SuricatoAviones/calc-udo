import { implementedCalculatorIds } from '@/components/calculators/registry';
import { buildSearchIndex } from '@/lib/search';

// Se genera una sola vez en el build (sitio estático) y el buscador lo descarga al abrirse, en
// lugar de incrustar el índice en cada página.
export const dynamic = 'force-static';

export function GET() {
  return Response.json(buildSearchIndex(implementedCalculatorIds));
}
