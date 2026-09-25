import { Badge } from '@/components/ui/badge';
import type { CalculatorStatus } from '@/lib/curriculum';
import { cn } from '@/lib/utils';

const LABELS: Record<CalculatorStatus | 'contenido-pendiente', string> = {
  implementada: 'Disponible',
  'en-progreso': 'En progreso',
  roadmap: 'Próximamente',
  'contenido-pendiente': 'Contenido pendiente',
};

const STYLES: Record<CalculatorStatus | 'contenido-pendiente', string> = {
  implementada: 'border-success/40 bg-success/10 text-success',
  'en-progreso': 'border-warning/50 bg-warning/10 text-foreground',
  roadmap: 'border-border bg-muted text-muted-foreground',
  'contenido-pendiente': 'border-dashed border-border bg-transparent text-muted-foreground',
};

export function StatusBadge({
  status,
  className,
}: {
  status: CalculatorStatus | 'contenido-pendiente';
  className?: string;
}) {
  return (
    <Badge variant="outline" className={cn('font-normal', STYLES[status], className)}>
      {LABELS[status]}
    </Badge>
  );
}
