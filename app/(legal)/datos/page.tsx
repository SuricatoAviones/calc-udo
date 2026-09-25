import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/layout/LegalPage';
import { getLegalDocument, legalPath, REPOSITORY_URL } from '@/data/legal';

const doc = getLegalDocument('datos');

export const metadata: Metadata = { title: doc.title, description: doc.description };

export default function DataPolicyPage() {
  return (
    <LegalPage slug="datos">
      <h2>1. Qué datos procesa una calculadora</h2>
      <p>
        Los que tú escribes en su formulario: funciones como <code>x^3 - 2x - 5</code>, valores
        iniciales, tolerancias, tasas de llegada y de servicio, matrices de transición, listas de
        observaciones, etc. Con ellos la calculadora produce el resultado y la traza del
        procedimiento: pasos, tablas de iteraciones y gráficas.
      </p>

      <h2>2. Dónde se procesan</h2>
      <p>
        <strong>En tu navegador, y solo ahí.</strong> CalcUDO es un sitio 100 % estático: el
        servidor entrega las páginas y el código, y todo el cálculo ocurre en tu dispositivo. No hay
        un servidor de cálculo ni una base de datos que reciba lo que escribes.
      </p>

      <h2>3. Cuánto tiempo se conservan</h2>
      <p>
        Solo mientras la página está abierta. Los datos del formulario y los resultados viven en la
        memoria de la pestaña y se pierden al recargarla, cerrarla o navegar a otra calculadora.
        CalcUDO no los guarda en tu dispositivo ni en ningún otro lugar.
      </p>

      <h2>4. Quién puede verlos</h2>
      <p>
        Nadie más que tú. No los compartimos, no los vendemos y no los usamos para entrenar modelos,
        hacer estadísticas ni mejorar el sitio, porque nunca llegan a nosotros.
      </p>
      <p>
        Si copias un resultado, haces una captura o compartes tu pantalla, lo que hagas con ese
        contenido queda bajo tu control.
      </p>

      <h2>5. Recomendación</h2>
      <p>
        Las calculadoras solo necesitan datos numéricos y expresiones matemáticas. Aunque no salgan
        de tu navegador, no escribas datos personales o sensibles en los campos: no hacen falta para
        ningún cálculo.
      </p>

      <h2>6. Cómo comprobarlo</h2>
      <p>
        El código de CalcUDO es abierto. Puedes revisar en{' '}
        <a href={REPOSITORY_URL} rel="noopener noreferrer">
          el repositorio
        </a>{' '}
        que las calculadoras son funciones puras que no hacen peticiones de red, o abrir la pestaña
        «Red» de las herramientas de desarrollo de tu navegador mientras calculas: no verás ningún
        envío de datos.
      </p>

      <h2>7. Documentos relacionados</h2>
      <p>
        Para los datos técnicos que registra el alojamiento, consulta la{' '}
        <Link href={legalPath('privacidad')}>política de privacidad</Link>; para la preferencia de
        tema, la <Link href={legalPath('cookies')}>política de cookies</Link>.
      </p>
    </LegalPage>
  );
}
