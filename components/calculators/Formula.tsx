import katex from 'katex';
import { cn } from '@/lib/utils';

interface FormulaProps {
  /** LaTeX sin delimitadores. */
  tex: string;
  /** `true` = fórmula en bloque, centrada y con scroll horizontal si no cabe. */
  display?: boolean;
  className?: string;
}

/**
 * Renderiza LaTeX con KaTeX (ADR-005). Funciona en Server y Client Components.
 * Si la expresión es inválida, KaTeX la muestra en rojo en vez de romper la página.
 */
export function Formula({ tex, display = false, className }: FormulaProps) {
  const html = katex.renderToString(tex, {
    displayMode: display,
    throwOnError: false,
    output: 'htmlAndMathml', // MathML para lectores de pantalla
    strict: 'ignore',
  });
  const Tag = display ? 'div' : 'span';
  return <Tag className={cn(className)} dangerouslySetInnerHTML={{ __html: html }} />;
}
