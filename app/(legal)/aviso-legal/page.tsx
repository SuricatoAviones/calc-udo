import type { Metadata } from 'next';
import Link from 'next/link';
import { LegalPage } from '@/components/layout/LegalPage';
import { CONTACT_URL, getLegalDocument, legalPath, REPOSITORY_URL } from '@/data/legal';

const doc = getLegalDocument('aviso-legal');

export const metadata: Metadata = { title: doc.title, description: doc.description };

export default function LegalNoticePage() {
  return (
    <LegalPage slug="aviso-legal">
      <h2>1. Quién publica CalcUDO</h2>
      <p>
        CalcUDO es un proyecto comunitario, gratuito y sin fines de lucro, mantenido por{' '}
        <strong>LuisAngel y los colaboradores de CalcUDO</strong>. Su código fuente es público en{' '}
        <a href={REPOSITORY_URL} rel="noopener noreferrer">
          GitHub
        </a>
        .
      </p>
      <p>
        <strong>CalcUDO no es un sitio oficial de la Universidad de Oriente (UDO)</strong> ni está
        afiliado, patrocinado o avalado por ella. El nombre de la universidad y de sus materias se
        usan solo para describir a qué pensum corresponden las calculadoras.
      </p>
      <p>
        Para cualquier consulta, reclamo o aviso sobre este sitio, abre un issue en{' '}
        <a href={CONTACT_URL} rel="noopener noreferrer">
          el repositorio del proyecto
        </a>
        .
      </p>

      <h2>2. Objeto del sitio</h2>
      <p>
        CalcUDO ofrece calculadoras académicas que muestran el procedimiento paso a paso de métodos
        cuantitativos (métodos numéricos, teoría de colas, procesos estocásticos, estadística, entre
        otros) para que los estudiantes puedan estudiar y verificar los ejercicios que resuelven a
        mano.
      </p>

      <h2>3. Condiciones de uso</h2>
      <p>
        El acceso es libre y no requiere registro. Al usar el sitio aceptas este aviso legal y te
        comprometes a:
      </p>
      <ul>
        <li>Usarlo con fines de aprendizaje y de forma lícita.</li>
        <li>
          No intentar dañar, sobrecargar o alterar el sitio ni el servidor que lo aloja, conforme a
          la Ley Especial contra los Delitos Informáticos de Venezuela.
        </li>
        <li>
          Respetar las normas de tu institución sobre el uso de herramientas de cálculo en
          evaluaciones. CalcUDO es un apoyo para estudiar, no un sustituto de tu propio trabajo.
        </li>
      </ul>

      <h2>4. Exactitud de los resultados</h2>
      <p>
        Los métodos se implementan siguiendo la bibliografía del pensum y se prueban contra ejemplos
        resueltos de esos libros. Aun así,{' '}
        <strong>los resultados se ofrecen con fines educativos y sin garantía de exactitud</strong>:
        pueden contener errores de programación o de redondeo, y un método numérico puede no
        converger con ciertos datos.
      </p>
      <p>
        Verifica siempre con tu libro de texto o con tu profesor. Los mantenedores no responden por
        decisiones académicas, profesionales o de cualquier otro tipo tomadas a partir de los
        resultados. Si encuentras un error, repórtalo en el repositorio: nos ayuda a corregirlo.
      </p>

      <h2>5. Propiedad intelectual</h2>
      <ul>
        <li>
          El código fuente de CalcUDO se publica bajo la{' '}
          <a href={`${REPOSITORY_URL}/blob/main/LICENSE`} rel="noopener noreferrer">
            licencia MIT
          </a>
          : puedes usarlo, copiarlo, modificarlo y redistribuirlo conservando el aviso de copyright
          y la licencia.
        </li>
        <li>
          Los libros citados en cada calculadora pertenecen a sus autores y editoriales. CalcUDO
          solo los referencia para indicar de dónde sale cada método; no reproduce sus contenidos.
        </li>
        <li>
          Las marcas y nombres de terceros (incluida la Universidad de Oriente) pertenecen a sus
          respectivos titulares.
        </li>
      </ul>

      <h2>6. Enlaces externos</h2>
      <p>
        El sitio puede enlazar a páginas de terceros, como el repositorio en GitHub. No controlamos
        su contenido ni sus políticas de privacidad, y no somos responsables de ellos.
      </p>

      <h2>7. Disponibilidad</h2>
      <p>
        CalcUDO se ofrece «tal cual», sin garantía de disponibilidad continua. Podemos modificar,
        suspender o retirar calculadoras o contenidos en cualquier momento, sin previo aviso.
      </p>

      <h2>8. Privacidad, datos y cookies</h2>
      <p>
        El tratamiento de información se explica en la{' '}
        <Link href={legalPath('privacidad')}>política de privacidad</Link>, la{' '}
        <Link href={legalPath('datos')}>política de datos</Link> y la{' '}
        <Link href={legalPath('cookies')}>política de cookies</Link>.
      </p>

      <h2>9. Legislación aplicable</h2>
      <p>
        Este aviso se rige por las leyes de la República Bolivariana de Venezuela. Cualquier
        controversia se someterá a los tribunales competentes de Venezuela, salvo que una norma
        imperativa disponga otra cosa.
      </p>

      <h2>10. Cambios en este aviso</h2>
      <p>
        Podemos actualizar este aviso para reflejar cambios en el sitio o en la normativa. La fecha
        de la última actualización aparece al principio de la página y el historial completo de
        cambios queda registrado en el repositorio.
      </p>
    </LegalPage>
  );
}
