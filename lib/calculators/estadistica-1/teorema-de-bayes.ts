/**
 * Probabilidad total y regla de Bayes (Walpole, Myers, Myers y Ye, sec. 2.7). Si B₁, …, B_k son
 * una partición del espacio muestral y A es un evento:
 *
 *   P(A) = Σ P(Bᵢ) P(A | Bᵢ)                                (regla de eliminación, teorema 2.13)
 *   P(B_r | A) = P(B_r) P(A | B_r) / Σ P(Bᵢ) P(A | Bᵢ)      (regla de Bayes, teorema 2.14)
 */
import { z } from 'zod';
import {
  formatNumber,
  fractionToLatex,
  latexLines,
  parseFraction,
  toLatexNumber,
  toLatexRational,
  toLatexText,
} from '@/lib/math/format';
import { emptyTrace, type Calculator, type CalculatorResult, type Step } from '../types';

const SUM_TOLERANCE = 1e-9;

const probabilityField = z.string().superRefine((text, ctx) => {
  const value = parseFraction(text.trim());
  if (Number.isNaN(value)) {
    ctx.addIssue({
      code: 'custom',
      message: 'Escribe un número o una fracción, p. ej. 0.3 o 1/3.',
    });
  } else if (value < 0 || value > 1) {
    ctx.addIssue({ code: 'custom', message: 'Debe estar entre 0 y 1.' });
  }
});

export const bayesInputSchema = z
  .object({
    events: z
      .array(
        z.object({
          name: z.string().trim().min(1, 'Escribe un nombre.').max(30, 'Máximo 30 caracteres.'),
          prior: probabilityField,
          likelihood: probabilityField,
        }),
      )
      .min(2, 'La partición necesita al menos 2 eventos.')
      .max(10, 'El máximo es 10 eventos.'),
  })
  .superRefine((v, ctx) => {
    const priors = v.events.map((e) => parseFraction(e.prior.trim()));
    if (priors.some(Number.isNaN)) return;
    const sum = priors.reduce((s, p) => s + p, 0);
    if (Math.abs(sum - 1) > SUM_TOLERANCE) {
      ctx.addIssue({
        code: 'custom',
        path: ['events'],
        message: `Las probabilidades P(Bᵢ) suman ${formatNumber(sum, 6)}; en una partición deben sumar 1.`,
      });
    }
  });

export type BayesInput = z.infer<typeof bayesInputSchema>;

export interface BayesValue {
  /** P(A), por probabilidad total. */
  evidence: number;
  /** P(Bᵢ | A), en el orden de la entrada. */
  posteriors: number[];
}

export type BayesErrorCode = 'zero-evidence';

const n = toLatexNumber;

export function solveBayes(input: BayesInput): CalculatorResult<BayesValue, BayesErrorCode> {
  const events = input.events.map((e, i) => ({
    index: i + 1,
    name: e.name.trim(),
    priorText: e.prior.trim(),
    likelihoodText: e.likelihood.trim(),
    prior: parseFraction(e.prior.trim()),
    likelihood: parseFraction(e.likelihood.trim()),
  }));
  const joints = events.map((e) => e.prior * e.likelihood);
  const evidence = joints.reduce((s, j) => s + j, 0);

  const steps: Step[] = [
    {
      title: 'Partición del espacio muestral',
      explanation: `Los eventos ${events.map((e) => `B${e.index} (${e.name})`).join(', ')} son mutuamente excluyentes y cubren todos los casos, así que sus probabilidades suman 1. A es el evento observado.`,
      formula: '\\sum P(B_i) = 1',
      substitution: `${events.map((e) => fractionToLatex(e.priorText)).join(' + ')} = ${n(
        events.reduce((s, e) => s + e.prior, 0),
        6,
      )}`,
    },
    {
      title: 'Probabilidad de cada rama del árbol',
      explanation:
        'Por la regla de multiplicación, la probabilidad de que ocurran Bᵢ y A es P(Bᵢ) por la probabilidad condicional de A dado Bᵢ.',
      formula: 'P(B_i \\cap A) = P(B_i)\\,P(A \\mid B_i)',
      substitution: latexLines(
        events.map(
          (e, i) =>
            `P(B_{${e.index}})P(A \\mid B_{${e.index}}) = \\left(${fractionToLatex(e.priorText)}\\right)\\left(${fractionToLatex(e.likelihoodText)}\\right) = ${n(joints[i]!)}`,
        ),
      ),
    },
    {
      title: 'Probabilidad total de A',
      explanation:
        'A ocurre por alguna de las ramas, que son mutuamente excluyentes: se suman (regla de eliminación).',
      formula: 'P(A) = \\sum_{i=1}^{k} P(B_i)\\,P(A \\mid B_i)',
      substitution: `P(A) = ${joints.map((j) => n(j)).join(' + ')}`,
      result: `P(A) = ${n(evidence)}`,
    },
  ];

  const trace = { ...emptyTrace(), steps };
  if (evidence === 0) {
    return {
      ok: false,
      error: {
        code: 'zero-evidence',
        message:
          'P(A) = 0: el evento observado es imposible con estos datos, así que P(Bᵢ | A) no está definida.',
      },
      ...trace,
    };
  }

  const posteriors = joints.map((j) => j / evidence);
  const best = posteriors.indexOf(Math.max(...posteriors));
  steps.push(
    {
      title: 'Regla de Bayes',
      explanation:
        'Dado que ocurrió A, la probabilidad de cada Bᵢ es la fracción de P(A) que aporta su rama.',
      formula:
        'P(B_r \\mid A) = \\frac{P(B_r)\\,P(A \\mid B_r)}{\\sum_{i=1}^{k} P(B_i)\\,P(A \\mid B_i)}',
      substitution: latexLines(
        events.map(
          (e, i) =>
            `P(B_{${e.index}} \\mid A) = \\frac{${n(joints[i]!)}}{${n(evidence)}} = ${toLatexRational(posteriors[i]!)}`,
        ),
      ),
    },
    {
      title: 'Conclusión',
      explanation: `Dado A, lo más probable es que haya ocurrido B${best + 1} (${events[best]!.name}), con probabilidad ${formatNumber(posteriors[best]!, 4)}. Las probabilidades a posteriori suman 1.`,
      result: `P(B_{${best + 1}} \\mid A) = ${n(posteriors[best]!, 6)}`,
    },
  );

  return {
    ok: true,
    value: { evidence, posteriors },
    summary: [
      { label: 'Probabilidad total', value: `P(A) = ${n(evidence, 6)}` },
      ...events.map((e, i) => ({
        label: `Dado A: ${e.name}`,
        value: `P(B_{${e.index}} \\mid A) = ${n(posteriors[i]!, 6)}`,
        emphasis: i === best,
      })),
    ],
    ...trace,
    tables: [
      {
        id: 'bayes',
        title: 'Probabilidades a priori y a posteriori',
        columns: [
          { key: 'event', header: 'B_i', format: 'latex' },
          { key: 'prior', header: 'P(B_i)' },
          { key: 'likelihood', header: 'P(A \\mid B_i)' },
          { key: 'joint', header: 'P(B_i \\cap A)' },
          { key: 'posterior', header: 'P(B_i \\mid A)' },
        ],
        rows: events.map((e, i) => ({
          event: `B_{${e.index}}\\ ${toLatexText(`(${e.name})`)}`,
          prior: e.prior,
          likelihood: e.likelihood,
          joint: joints[i]!,
          posterior: posteriors[i]!,
        })),
      },
    ],
  };
}

export const bayes: Calculator<BayesInput, BayesValue, BayesErrorCode> = {
  meta: {
    id: 'teorema-de-bayes',
    title: 'Probabilidad condicional y teorema de Bayes',
    summary: 'Probabilidad total de un evento y probabilidades a posteriori de cada causa.',
    citations: [
      {
        sourceId: 'walpole-1999',
        locator: 'Sec. 2.7, teoremas 2.13 y 2.14, Ejemplos 2.41 a 2.43 (9.ª ed. en español)',
      },
      { sourceId: 'canavos-1995' },
      { sourceId: 'meyer-1998' },
    ],
  },
  inputSchema: bayesInputSchema,
  // Walpole, ejemplos 2.41 y 2.42: tres máquinas ensamblan 30 %, 45 % y 25 % de los productos, con
  // 2 %, 3 % y 2 % de defectuosos.
  example: {
    events: [
      { name: 'Máquina 1', prior: '0.3', likelihood: '0.02' },
      { name: 'Máquina 2', prior: '0.45', likelihood: '0.03' },
      { name: 'Máquina 3', prior: '0.25', likelihood: '0.02' },
    ],
  },
  solve: solveBayes,
};
