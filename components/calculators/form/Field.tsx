import type { ReactNode } from 'react';
import { Label } from '@/components/ui/label';

interface FieldProps {
  id: string;
  label: ReactNode;
  hint?: ReactNode;
  error?: string;
  children: ReactNode;
}

/**
 * Etiqueta + control + ayuda + error, con los atributos ARIA conectados. El control (hijo) debe
 * usar el mismo `id` y `aria-describedby={describedBy(id)}`.
 */
export function Field({ id, label, hint, error, children }: FieldProps) {
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>{label}</Label>
      {children}
      {hint && !error && (
        <p id={`${id}-hint`} className="text-muted-foreground text-xs">
          {hint}
        </p>
      )}
      {error && (
        <p id={`${id}-error`} role="alert" className="text-destructive text-xs">
          {error}
        </p>
      )}
    </div>
  );
}

export function describedBy(id: string, hasError: boolean): string {
  return hasError ? `${id}-error` : `${id}-hint`;
}
