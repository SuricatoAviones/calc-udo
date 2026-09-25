import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/layout/LegalPage';
import { CONTACT_URL, getLegalDocument, legalPath } from '@/data/legal';

const doc = getLegalDocument('privacidad');

export const metadata: Metadata = { title: doc.title, description: doc.description };

export default function PrivacyPolicyPage() {
  return (
    <LegalPage slug="privacidad">
      <p>
        <strong>En resumen:</strong> CalcUDO no tiene cuentas, formularios de contacto, analítica ni
        publicidad. No recogemos, vendemos ni compartimos datos personales. Esta página explica los
        detalles.
      </p>

      <h2>1. Responsable</h2>
      <p>
        El sitio lo mantienen LuisAngel y los colaboradores de CalcUDO (ver el{' '}
        <Link href={legalPath('aviso-legal')}>aviso legal</Link>). Puedes contactarnos abriendo un
        issue en{' '}
        <a href={CONTACT_URL} rel="noopener noreferrer">
          el repositorio del proyecto
        </a>
        .
      </p>

      <h2>2. Qué datos personales tratamos</h2>
      <p>
        <strong>Ninguno de forma directa.</strong> CalcUDO es un sitio estático: todas las
        calculadoras se ejecutan en tu navegador y no envían lo que escribes a ningún servidor. No
        pedimos tu nombre, correo, cédula ni ningún otro dato para usarlo.
      </p>
      <p>En concreto, CalcUDO no usa:</p>
      <ul>
        <li>Registro de usuarios ni inicio de sesión.</li>
        <li>Herramientas de analítica o medición de audiencia (Google Analytics y similares).</li>
        <li>Publicidad, píxeles de seguimiento ni redes sociales integradas.</li>
        <li>
          Recursos de terceros cargados en tiempo de ejecución: las fuentes tipográficas y las
          fórmulas (KaTeX) se sirven desde el propio sitio.
        </li>
      </ul>

      <h2>3. Registros técnicos del alojamiento</h2>
      <p>
        Como ocurre con cualquier página web, el servidor que aloja el sitio puede registrar datos
        técnicos de cada conexión: dirección IP, fecha y hora, página solicitada y tipo de
        navegador. Esos registros los genera el proveedor de alojamiento para servir el sitio y
        protegerlo frente a abusos, y se conservan según sus propias políticas.
      </p>
      <p>
        CalcUDO no usa esos registros para identificarte, elaborar perfiles ni con fines
        comerciales.
      </p>

      <h2>4. Información guardada en tu navegador</h2>
      <p>
        Si cambias entre tema claro y oscuro, tu navegador recuerda esa preferencia. No es una
        cookie ni sale de tu dispositivo. Los detalles están en la{' '}
        <Link href={legalPath('cookies')}>política de cookies</Link>.
      </p>

      <h2>5. Lo que escribes en las calculadoras</h2>
      <p>
        Las funciones, números, matrices y listas de datos se procesan solo en tu navegador y se
        pierden al cerrar o recargar la página. Lo explicamos en la{' '}
        <Link href={legalPath('datos')}>política de datos</Link>.
      </p>

      <h2>6. Menores de edad</h2>
      <p>
        CalcUDO está pensado para estudiantes universitarios, pero cualquier persona puede usarlo:
        como no recogemos datos personales, no hay información de menores que proteger ni tratar.
      </p>

      <h2>7. Tus derechos</h2>
      <p>
        La Constitución de la República Bolivariana de Venezuela reconoce el derecho a la protección
        de la vida privada (artículo 60) y el derecho de acceder, actualizar, rectificar o destruir
        la información que sobre ti conste en registros (<em>habeas data</em>, artículo 28). Si
        estás en otro país, puedes tener derechos similares según tu legislación.
      </p>
      <p>
        Como CalcUDO no guarda datos personales, normalmente no habrá nada que consultar ni borrar.
        Aun así, si tienes cualquier duda o solicitud, escríbenos por el canal de contacto y la
        atenderemos.
      </p>

      <h2>8. Cambios en esta política</h2>
      <p>
        Si en el futuro CalcUDO incorpora algo que trate datos personales (por ejemplo, analítica),
        actualizaremos esta página <strong>antes</strong> de activarlo y cambiaremos la fecha de
        actualización. El historial de cambios queda en el repositorio.
      </p>
    </LegalPage>
  );
}
