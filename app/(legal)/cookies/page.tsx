import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/layout/LegalPage';
import { getLegalDocument, legalPath } from '@/data/legal';

const doc = getLegalDocument('cookies');

export const metadata: Metadata = { title: doc.title, description: doc.description };

/** Única entrada que CalcUDO guarda en el navegador (ver components/layout/ThemeToggle.tsx). */
const storageEntries = [
  {
    name: 'calcudo-theme',
    type: 'Almacenamiento local (localStorage)',
    purpose: 'Recordar si elegiste el tema claro o el oscuro.',
    value: '«light» o «dark»',
    duration: 'Hasta que la borres desde tu navegador.',
    owner: 'Propia (CalcUDO). No se envía a ningún servidor.',
  },
];

export default function CookiePolicyPage() {
  return (
    <LegalPage slug="cookies">
      <h2>1. ¿Usa cookies CalcUDO?</h2>
      <p>
        <strong>No.</strong> CalcUDO no crea cookies propias ni permite cookies de terceros: no hay
        analítica, publicidad, botones de redes sociales ni inicios de sesión. Por eso tampoco verás
        un banner de consentimiento.
      </p>

      <h2>2. Qué guardamos en tu navegador</h2>
      <p>
        Solo una cosa, y solo si pulsas el botón de tema (el sol o la luna del encabezado): tu
        preferencia de tema claro u oscuro, guardada en el almacenamiento local del navegador. A
        diferencia de una cookie, este dato no viaja en cada visita al servidor; se queda en tu
        dispositivo.
      </p>
      <p>
        Si nunca pulsas el botón, no se guarda nada y el sitio sigue el tema de tu sistema
        operativo.
      </p>

      {storageEntries.map((entry) => (
        <dl
          key={entry.name}
          className="bg-card grid gap-x-4 gap-y-2 rounded-lg border p-4 text-sm shadow-xs sm:grid-cols-[10rem_1fr]"
        >
          <dt className="text-muted-foreground">Nombre</dt>
          <dd>
            <code>{entry.name}</code>
          </dd>
          <dt className="text-muted-foreground">Tipo</dt>
          <dd>{entry.type}</dd>
          <dt className="text-muted-foreground">Finalidad</dt>
          <dd>{entry.purpose}</dd>
          <dt className="text-muted-foreground">Valor</dt>
          <dd>{entry.value}</dd>
          <dt className="text-muted-foreground">Duración</dt>
          <dd>{entry.duration}</dd>
          <dt className="text-muted-foreground">Titular</dt>
          <dd>{entry.owner}</dd>
        </dl>
      ))}

      <p>
        Es un almacenamiento estrictamente funcional: lo activas tú al pedir el cambio de tema, no
        te identifica y no sirve para seguirte entre sitios.
      </p>

      <h2>3. Cómo borrarlo</h2>
      <p>Puedes eliminarlo en cualquier momento, sin que el sitio deje de funcionar:</p>
      <ul>
        <li>
          Borrando los «datos de sitios» o «cookies y datos de sitios» de CalcUDO en la
          configuración de privacidad de tu navegador.
        </li>
        <li>
          Usando una ventana de navegación privada: al cerrarla, el navegador descarta la
          preferencia.
        </li>
      </ul>

      <h2>4. Cambios en esta política</h2>
      <p>
        Si CalcUDO llegara a usar cookies u otro almacenamiento, lo añadiremos a esta página antes
        de activarlo y, cuando la ley lo exija, pediremos tu consentimiento. Consulta también la{' '}
        <Link href={legalPath('privacidad')}>política de privacidad</Link>.
      </p>
    </LegalPage>
  );
}
