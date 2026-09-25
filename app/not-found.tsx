import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="flex flex-col items-start gap-4 pt-10">
      <p className="text-pencil font-mono text-sm">404</p>
      <h1 className="text-3xl font-semibold">Esta página no está en el pensum</h1>
      <p className="text-muted-foreground">
        Puede que la calculadora aún no exista o que el enlace esté mal escrito.
      </p>
      <Link href="/" className="underline underline-offset-4">
        Volver al inicio
      </Link>
    </div>
  );
}
