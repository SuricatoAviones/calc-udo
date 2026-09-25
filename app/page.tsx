import Link from 'next/link';
import { implementedCalculatorIds } from '@/components/calculators/registry';
import { StatusBadge } from '@/components/curriculum/StatusBadge';
import {
  formatSemester,
  getSubjects,
  getTopicCalculators,
  subjectPath,
  type Subject,
} from '@/lib/curriculum';

function countCalculators(subject: Subject) {
  const ids = new Set(
    subject.topics.flatMap((t) => getTopicCalculators(t).map((l) => l.calculator.id)),
  );
  const implemented = [...ids].filter((id) => implementedCalculatorIds.has(id)).length;
  return { total: ids.size, implemented };
}

function SubjectCard({ subject }: { subject: Subject }) {
  const { total, implemented } = countCalculators(subject);
  return (
    <Link
      href={subjectPath(subject)}
      className="group bg-card hover:border-primary/40 flex flex-col gap-2 rounded-lg border p-4 shadow-xs transition-[border-color,box-shadow] hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-2">
        <span className="text-muted-foreground font-mono text-xs">{subject.code}</span>
        {subject.content === 'pendiente' ? (
          <StatusBadge status="contenido-pendiente" />
        ) : (
          <span className="text-muted-foreground tabular text-xs">
            {implemented}/{total} calculadoras
          </span>
        )}
      </div>
      <h3 className="group-hover:text-primary text-lg leading-snug font-semibold">
        {subject.name}
      </h3>
      <p className="text-muted-foreground mt-auto text-xs">
        {subject.topics.length > 0 ? `${subject.topics.length} temas · ` : ''}
        {subject.creditsLabel} créditos
      </p>
    </Link>
  );
}

function SubjectGroup({ id, title, subjects }: { id: string; title: string; subjects: Subject[] }) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-4">
      <h2 id={id} className="border-b pb-2 text-xl font-semibold">
        {title}
      </h2>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {subjects.map((s) => (
          <SubjectCard key={s.slug} subject={s} />
        ))}
      </div>
    </section>
  );
}

export default function HomePage() {
  const subjects = getSubjects();
  const semesters = [...new Set(subjects.flatMap((s) => (s.semester ? [s.semester] : [])))].sort(
    (a, b) => a - b,
  );
  const electives = subjects.filter((s) => s.semester === null);

  return (
    <div className="flex flex-col gap-12">
      <section className="flex flex-col gap-4 pt-4 sm:pt-10">
        <p className="text-pencil font-mono text-xs tracking-widest uppercase">
          Ingeniería de Sistemas · UDO
        </p>
        <h1 className="max-w-2xl text-4xl leading-[1.05] font-semibold sm:text-5xl">
          No solo el resultado: <em className="text-pencil font-normal">el procedimiento.</em>
        </h1>
        <p className="text-muted-foreground max-w-xl text-lg">
          Calculadoras organizadas por materia y tema que muestran cada paso con sus fórmulas, para
          estudiar y para verificar los ejercicios que resuelves a mano.
        </p>
      </section>

      {semesters.map((semester) => {
        const group = subjects.filter((s) => s.semester === semester);
        return (
          <SubjectGroup
            key={semester}
            id={`semestre-${semester}`}
            title={formatSemester(group[0]!)}
            subjects={group}
          />
        );
      })}

      {electives.length > 0 && (
        <SubjectGroup id="electivas" title="Electivas técnicas" subjects={electives} />
      )}
    </div>
  );
}
