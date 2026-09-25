import { BookOpen } from 'lucide-react';
import type { Citation } from '@/lib/calculators/types';
import { formatSource, getSource } from '@/lib/curriculum';

/** Bibliografía del método, para que el estudiante pueda ir al libro. */
export function References({ citations }: { citations: Citation[] }) {
  return (
    <ul className="flex flex-col gap-2 text-sm">
      {citations.map((citation) => {
        const source = getSource(citation.sourceId);
        if (!source) return null;
        return (
          <li key={`${citation.sourceId}-${citation.locator ?? ''}`} className="flex gap-2">
            <BookOpen className="text-muted-foreground mt-0.5 size-4 shrink-0" aria-hidden />
            <p>
              {formatSource(source)}
              {citation.locator && (
                <span className="text-muted-foreground"> — {citation.locator}</span>
              )}
            </p>
          </li>
        );
      })}
    </ul>
  );
}
