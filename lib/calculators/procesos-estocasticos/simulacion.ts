/**
 * Simulación manual de una cola con un servidor (Taha, secs. 19.4 y 19.5.1): los tiempos entre
 * llegadas y de servicio se generan a partir de números aleatorios R ∈ (0, 1) con la
 * transformada inversa:
 *
 *   exponencial de media β:  t = −β ln R;    uniforme en [a, b]:  t = a + (b − a) R;    constante: t = c
 *
 * Los números aleatorios se dan en una lista (como la tabla 19.1 del libro) o se generan con el
 * método congruencial multiplicativo: u_n = (b·u_{n−1} + c) mod m, R_n = u_n / m.
 *
 * El primer cliente llega en T = 0 con el sistema vacío. Se procesan los eventos en orden
 * cronológico y cada número aleatorio se usa en el momento en que hace falta (como en el libro):
 * al llegar un cliente se genera la llegada del siguiente y, si el servidor está libre, su
 * servicio; al terminar un servicio, si hay cola, se genera el servicio del siguiente.
 *
 *   Longitud promedio de la cola = (área bajo la curva de la cola) / T
 *   Utilización = (tiempo ocupado) / T,   W_q = Σ esperas / número de clientes
 */
import { z } from 'zod';
import { parseDataList } from '@/lib/math/data-list';
import { formatNumber, toLatexNumber, TEX } from '@/lib/math/format';
import {
  emptyTrace,
  type Calculator,
  type CalculatorResult,
  type CellValue,
  type Series,
  type Step,
} from '../types';

export const randomSources = ['lista', 'congruencial'] as const;
export const timeDistributions = ['exponencial', 'uniforme', 'constante'] as const;
export type TimeDistribution = (typeof timeDistributions)[number];

const MAX_CUSTOMERS = 100;
const MAX_NUMBERS = 1000;

function parseRandomNumbers(text: string | undefined): number[] | string {
  const { values, invalid } = parseDataList(text ?? '');
  if (invalid.length > 0) return `No son números: ${invalid.slice(0, 3).join(', ')}.`;
  if (values.length === 0) return 'Escribe los números aleatorios.';
  if (values.length > MAX_NUMBERS) return `El máximo es ${MAX_NUMBERS} números.`;
  if (values.some((v) => !(v > 0 && v < 1))) {
    return 'Los números aleatorios deben estar entre 0 y 1 (sin incluir los extremos).';
  }
  return values;
}

const positive = (label: string) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .refine((v) => Number.isFinite(v) && v > 0, `${label} debe ser mayor que 0.`);

const integerParameter = (label: string, min: number) =>
  z
    .number({ error: `Ingresa ${label}.` })
    .int(`${label} debe ser un número entero.`)
    .min(min, `${label} debe ser al menos ${min}.`)
    .max(2 ** 31, `${label} es demasiado grande.`);

export const simulationInputSchema = z
  .object({
    customers: z
      .number({ error: 'Ingresa el número de clientes.' })
      .int('El número de clientes debe ser entero.')
      .min(1, 'Simula al menos 1 cliente.')
      .max(MAX_CUSTOMERS, `El máximo es ${MAX_CUSTOMERS} clientes.`),
    arrivalDistribution: z.enum(timeDistributions, { error: 'Elige la distribución.' }),
    arrivalA: positive('el parámetro de las llegadas'),
    arrivalB: positive('el segundo parámetro de las llegadas').optional(),
    serviceDistribution: z.enum(timeDistributions, { error: 'Elige la distribución.' }),
    serviceA: positive('el parámetro del servicio'),
    serviceB: positive('el segundo parámetro del servicio').optional(),
    source: z.enum(randomSources, { error: 'Elige de dónde salen los números aleatorios.' }),
    numbers: z.string().optional(),
    seed: integerParameter('la semilla u₀', 0).optional(),
    multiplier: integerParameter('el multiplicador b', 1).optional(),
    increment: integerParameter('el incremento c', 0).optional(),
    modulus: integerParameter('el módulo m', 2).optional(),
  })
  .superRefine((v, ctx) => {
    for (const prefix of ['arrival', 'service'] as const) {
      const a = v[`${prefix}A`];
      const b = v[`${prefix}B`];
      if (v[`${prefix}Distribution`] !== 'uniforme') continue;
      if (b === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [`${prefix}B`],
          message: 'Indica el extremo superior b de la uniforme.',
        });
      } else if (b <= a) {
        ctx.addIssue({
          code: 'custom',
          path: [`${prefix}B`],
          message: 'El extremo superior b debe ser mayor que a.',
        });
      }
    }
    if (v.source === 'lista') {
      const parsed = parseRandomNumbers(v.numbers);
      if (typeof parsed === 'string') {
        ctx.addIssue({ code: 'custom', path: ['numbers'], message: parsed });
      }
      return;
    }
    for (const field of ['seed', 'multiplier', 'increment', 'modulus'] as const) {
      if (v[field] === undefined) {
        ctx.addIssue({
          code: 'custom',
          path: [field],
          message: 'Completa los parámetros del generador.',
        });
        return;
      }
    }
    if (v.seed! >= v.modulus! || v.multiplier! >= v.modulus! || v.increment! >= v.modulus!) {
      ctx.addIssue({
        code: 'custom',
        path: ['modulus'],
        message: 'La semilla, b y c deben ser menores que el módulo m.',
      });
    }
  });

export type SimulationInput = z.infer<typeof simulationInputSchema>;

export interface SimulatedCustomer {
  customer: number;
  arrival: number;
  start: number;
  wait: number;
  departure: number;
}

export interface SimulationEvent {
  time: number;
  kind: 'llegada' | 'salida';
  customer: number;
  /** Largo de la cola y estado del servidor justo después del evento. */
  queue: number;
  busy: boolean;
  generated: string[];
}

export interface SimulationValue {
  customers: SimulatedCustomer[];
  events: SimulationEvent[];
  /** Números aleatorios usados, en orden. */
  randomNumbers: number[];
  /** Números disponibles (la lista dada o los generados). */
  supply: number[];
  totalTime: number;
  averageQueue: number;
  utilization: number;
  averageWait: number;
  averageTimeInSystem: number;
  maxQueue: number;
}

export type SimulationErrorCode = 'not-enough-numbers';

type Result = CalculatorResult<SimulationValue, SimulationErrorCode>;

const n = toLatexNumber;
const fmt = (v: number) => formatNumber(v, 6);

interface Sampler {
  distribution: TimeDistribution;
  a: number;
  b: number | undefined;
}

function sample(s: Sampler, R: number): number {
  if (s.distribution === 'exponencial') return -s.a * Math.log(R);
  if (s.distribution === 'uniforme') return s.a + (s.b! - s.a) * R;
  return s.a;
}

/** «−15 ln(0.0589) = 42.48» o el valor constante. */
function sampleLatex(s: Sampler, R: number | null, value: number): string {
  if (s.distribution === 'exponencial') return String.raw`-${n(s.a)}\ln(${n(R!)}) = ${n(value, 6)}`;
  if (s.distribution === 'uniforme') {
    return `${n(s.a)} + (${n(s.b!)} - ${n(s.a)})(${n(R!)}) = ${n(value, 6)}`;
  }
  return n(value, 6);
}

const DISTRIBUTION_LATEX: Record<TimeDistribution, string> = {
  exponencial: String.raw`t = -\beta \ln R`,
  uniforme: String.raw`t = a + (b - a)\,R`,
  constante: 't = c',
};

/** Números del generador congruencial, sin los u = 0, y la longitud de su ciclo. */
function congruential(
  seed: number,
  b: number,
  c: number,
  m: number,
  count: number,
): { numbers: number[]; lines: string[]; cycle: number; skipped: number } {
  const numbers: number[] = [];
  const lines: string[] = [];
  let u = seed;
  let skipped = 0;
  for (let k = 1; numbers.length < count && k <= 2 * count + m; k++) {
    const previous = u;
    u = (b * u + c) % m;
    if (lines.length < 6) {
      lines.push(
        String.raw`u_{${k}} = (${b} \cdot ${previous} + ${c}) \bmod ${m} = ${u},\ R_{${k}} = \frac{${u}}{${m}} = ${n(u / m, 4)}`,
      );
    }
    // R = 0 no sirve para ln R: se descarta.
    if (u === 0) skipped++;
    else numbers.push(u / m);
  }
  let cycle = 0;
  const seen = new Map<number, number>();
  let x = seed;
  for (let k = 0; k <= m; k++) {
    if (seen.has(x)) {
      cycle = k - seen.get(x)!;
      break;
    }
    seen.set(x, k);
    x = (b * x + c) % m;
  }
  return { numbers, lines, cycle, skipped };
}

/** Números aleatorios: la lista dada o los del generador congruencial, con su paso. */
function randomSupply(input: SimulationInput): { supply: number[]; step: Step } {
  if (input.source === 'lista') {
    const parsed = parseRandomNumbers(input.numbers);
    const supply = typeof parsed === 'string' ? [] : parsed;
    const listed = supply
      .slice(0, 12)
      .map((r) => n(r))
      .join(TEX.listSep);
    const more = supply.length > 12 ? String.raw`,\ \ldots` : '';
    return {
      supply,
      step: {
        title: 'Números aleatorios',
        explanation: `Se usan en orden, a medida que la simulación los necesita (${supply.length} disponibles).`,
        result: listed + more,
      },
    };
  }
  const generated = congruential(
    input.seed!,
    input.multiplier!,
    input.increment!,
    input.modulus!,
    2 * input.customers,
  );
  const skippedNote =
    generated.skipped > 0
      ? ` Se descartaron ${generated.skipped} valores con u = 0, porque ln 0 no existe.`
      : '';
  return {
    supply: generated.numbers,
    step: {
      title: 'Generar los números aleatorios (método congruencial multiplicativo)',
      explanation: `Cada número se obtiene del anterior y la sucesión se repite cada ${generated.cycle} números: con un módulo pequeño los «aleatorios» se repiten pronto.${skippedNote}`,
      formula: String.raw`u_n = (b\,u_{n-1} + c) \bmod m, \qquad R_n = \frac{u_n}{m}`,
      substitution: generated.lines.join(String.raw` \\ `),
      result: String.raw`\text{ciclo de longitud } ${generated.cycle}`,
    },
  };
}

type Pending = { time: number; customer: number };

/** Estado de la simulación por eventos. */
interface SimState {
  supply: number[];
  cursor: number;
  used: number[];
  customers: SimulatedCustomer[];
  queue: number[];
  busy: boolean;
  /** Próximos eventos. */
  schedule: { arrival: Pending | null; departure: Pending | null };
  clock: number;
}

/** Tiempo con el siguiente número aleatorio; `null` si se acabaron. */
function drawTime(state: SimState, sampler: Sampler): { R: number | null; value: number } | null {
  if (sampler.distribution === 'constante') return { R: null, value: sampler.a };
  if (state.cursor >= state.supply.length) return null;
  const R = state.supply[state.cursor++]!;
  state.used.push(R);
  return { R, value: sample(sampler, R) };
}

/** Empieza el servicio de `customer` en `time`; `false` si no quedan números. */
function startService(
  state: SimState,
  service: Sampler,
  customer: number,
  time: number,
  generated: string[],
  details: string[],
): boolean {
  const draw = drawTime(state, service);
  if (!draw) return false;
  const record = state.customers[customer - 1]!;
  record.start = time;
  record.wait = time - record.arrival;
  record.departure = time + draw.value;
  state.busy = true;
  state.schedule.departure = { time: record.departure, customer };
  generated.push(
    draw.R === null
      ? `servicio ${fmt(draw.value)}`
      : `R = ${fmt(draw.R)} → servicio ${fmt(draw.value)}`,
  );
  details.push(
    String.raw`T_{\text{salida } ${customer}} = ${n(time, 6)} + ${sampleLatex(service, draw.R, draw.value)} = ${n(record.departure, 6)}`,
  );
  return true;
}

/** Llegada: se programa la siguiente y el cliente pasa a servicio o a la cola. */
function handleArrival(
  state: SimState,
  samplers: { arrival: Sampler; service: Sampler },
  total: number,
  customer: number,
  generated: string[],
  details: string[],
): boolean {
  const clock = state.clock;
  state.customers.push({
    customer,
    arrival: clock,
    start: Number.NaN,
    wait: Number.NaN,
    departure: Number.NaN,
  });
  state.schedule.arrival = null;
  if (customer < total) {
    const draw = drawTime(state, samplers.arrival);
    if (!draw) return false;
    state.schedule.arrival = { time: clock + draw.value, customer: customer + 1 };
    const used = draw.R === null ? '' : `R = ${fmt(draw.R)} → `;
    generated.push(`${used}llegada del ${customer + 1} en ${fmt(clock + draw.value)}`);
    details.push(
      String.raw`T_{\text{llegada } ${customer + 1}} = ${n(clock, 6)} + ${sampleLatex(samplers.arrival, draw.R, draw.value)} = ${n(clock + draw.value, 6)}`,
    );
  }
  if (!state.busy) {
    details.push(String.raw`\text{Servidor libre: empieza el servicio}`);
    return startService(state, samplers.service, customer, clock, generated, details);
  }
  state.queue.push(customer);
  details.push(String.raw`\text{Servidor ocupado: el cliente ${customer} pasa a la cola}`);
  return true;
}

/** Salida: el servidor atiende al primero de la cola o queda libre. */
function handleDeparture(
  state: SimState,
  service: Sampler,
  generated: string[],
  details: string[],
): boolean {
  state.schedule.departure = null;
  state.busy = false;
  const waiting = state.queue.shift();
  if (waiting === undefined) {
    details.push(String.raw`\text{Cola vacía: el servidor queda libre}`);
    return true;
  }
  const record = state.customers[waiting - 1]!;
  details.push(
    `W_{${waiting}} = ${n(state.clock, 6)} - ${n(record.arrival, 6)} = ${n(state.clock - record.arrival, 6)}`,
  );
  return startService(state, service, waiting, state.clock, generated, details);
}

/** El siguiente evento; con empate, primero la salida (libera al servidor). */
function nextEvent(schedule: SimState['schedule']): { event: Pending; isArrival: boolean } {
  const { arrival, departure } = schedule;
  const isArrival =
    arrival !== null && (departure === null || arrival.time < departure.time - 1e-12);
  return { event: (isArrival ? arrival : departure)!, isArrival };
}

interface SimulationRun {
  complete: boolean;
  state: SimState;
  events: SimulationEvent[];
  eventSteps: Step[];
  queueArea: number;
  busyTime: number;
  maxQueue: number;
  queuePoints: { x: number; y: number }[];
}

/** Simulación por eventos: avanza el reloj de evento en evento hasta atender a todos. */
function simulate(
  samplers: { arrival: Sampler; service: Sampler },
  total: number,
  supply: number[],
): SimulationRun {
  const state: SimState = {
    supply,
    cursor: 0,
    used: [],
    customers: [],
    queue: [],
    busy: false,
    schedule: { arrival: { time: 0, customer: 1 }, departure: null },
    clock: 0,
  };
  const run: SimulationRun = {
    complete: false,
    state,
    events: [],
    eventSteps: [],
    queueArea: 0,
    busyTime: 0,
    maxQueue: 0,
    queuePoints: [{ x: 0, y: 0 }],
  };
  while (state.schedule.arrival !== null || state.schedule.departure !== null) {
    const { event, isArrival } = nextEvent(state.schedule);
    const elapsed = event.time - state.clock;
    run.queueArea += state.queue.length * elapsed;
    if (state.busy) run.busyTime += elapsed;
    state.clock = event.time;
    const generated: string[] = [];
    const details: string[] = [];
    const handled = isArrival
      ? handleArrival(state, samplers, total, event.customer, generated, details)
      : handleDeparture(state, samplers.service, generated, details);
    if (!handled) return run;
    recordEvent(run, isArrival, event.customer, generated, details);
  }
  run.complete = true;
  return run;
}

/** Anota el evento en la lista, la gráfica de la cola y (los primeros 40) en los pasos. */
function recordEvent(
  run: SimulationRun,
  isArrival: boolean,
  customer: number,
  generated: string[],
  details: string[],
): void {
  const { state } = run;
  run.maxQueue = Math.max(run.maxQueue, state.queue.length);
  run.queuePoints.push({ x: state.clock, y: state.queue.length });
  run.events.push({
    time: state.clock,
    kind: isArrival ? 'llegada' : 'salida',
    customer,
    queue: state.queue.length,
    busy: state.busy,
    generated,
  });
  if (run.eventSteps.length >= 40) return;
  const server = state.busy ? 'ocupado' : 'libre';
  run.eventSteps.push({
    title: `${isArrival ? 'Llegada' : 'Salida'} del cliente ${customer} en T = ${fmt(state.clock)}`,
    substitution: details.join(String.raw` \\ `),
    result: String.raw`\text{Cola} = ${state.queue.length}, \quad \text{servidor ${server}}`,
  });
}

export function solveSimulation(input: SimulationInput): Result {
  const steps: Step[] = [];
  const arrival: Sampler = {
    distribution: input.arrivalDistribution,
    a: input.arrivalA,
    b: input.arrivalB,
  };
  const service: Sampler = {
    distribution: input.serviceDistribution,
    a: input.serviceA,
    b: input.serviceB,
  };

  // Cada cliente usa a lo sumo dos números (llegada del siguiente y su servicio).
  const { supply, step: supplyStep } = randomSupply(input);
  steps.push(supplyStep, {
    title: 'Transformada inversa',
    explanation:
      'Cada tiempo se obtiene de un número aleatorio R con la inversa de su función de distribución.',
    formula: String.raw`\text{Llegadas: } ${DISTRIBUTION_LATEX[arrival.distribution]}, \qquad \text{servicio: } ${DISTRIBUTION_LATEX[service.distribution]}`,
  });

  const run = simulate({ arrival, service }, input.customers, supply);
  const { events, eventSteps, queueArea, busyTime, maxQueue, queuePoints } = run;
  const { customers, used } = run.state;
  if (!run.complete) {
    return {
      ok: false,
      error: {
        code: 'not-enough-numbers',
        message: `Se acabaron los números aleatorios después de usar ${used.length}. Agrega más números o simula menos clientes.`,
      },
      ...emptyTrace(),
      steps: [...steps, { title: 'Eventos simulados', children: eventSteps }],
    };
  }

  const totalTime = run.state.clock;
  const averageQueue = totalTime > 0 ? queueArea / totalTime : 0;
  const utilization = totalTime > 0 ? busyTime / totalTime : 0;
  const waits = customers.map((c) => c.wait);
  const averageWait = waits.reduce((a, b) => a + b, 0) / customers.length;
  const averageTimeInSystem =
    customers.reduce((acc, c) => acc + (c.departure - c.arrival), 0) / customers.length;

  steps.push(
    {
      title: 'Eventos simulados',
      explanation:
        'En cada evento se avanza el reloj al siguiente evento de la lista y se generan los tiempos que hagan falta.',
      children: eventSteps,
    },
    {
      title: 'Longitud promedio de la cola',
      explanation:
        'Es una variable basada en el tiempo: el área bajo la curva del largo de la cola dividida entre el tiempo simulado. Esa área es igual a la suma de las esperas.',
      formula: String.raw`\bar L_q = \frac{\text{área bajo la cola}}{T}`,
      substitution: String.raw`\bar L_q = \frac{${n(queueArea, 6)}}{${n(totalTime, 6)}}`,
      result: String.raw`\bar L_q = ${n(averageQueue, 6)}`,
    },
    {
      title: 'Utilización del servidor',
      formula: String.raw`\text{Utilización} = \frac{\text{tiempo ocupado}}{T}`,
      substitution: String.raw`\frac{${n(busyTime, 6)}}{${n(totalTime, 6)}}`,
      result: String.raw`\text{Utilización} = ${n(utilization, 6)}`,
    },
    {
      title: 'Espera promedio en la cola',
      explanation:
        'Es una variable basada en observaciones: el promedio de las esperas de los clientes.',
      formula: String.raw`\bar W_q = \frac{\sum W_i}{N}`,
      substitution: String.raw`\bar W_q = \frac{${waits
        .slice(0, 8)
        .map((w) => n(w, 6))
        .join(' + ')}${waits.length > 8 ? TEX.plusCdots : ''}}{${customers.length}}`,
      result: String.raw`\bar W_q = ${n(averageWait, 6)}`,
    },
  );

  const eventRows = events.map((e): Record<string, CellValue> => ({
    time: e.time,
    event: `${e.kind === 'llegada' ? 'Llegada' : 'Salida'} ${e.customer}`,
    generated: e.generated.join('; ') || '—',
    queue: e.queue,
    server: e.busy ? 'ocupado' : 'libre',
  }));
  const series: Series[] = [
    {
      id: 'cola',
      title: 'Largo de la cola en el tiempo',
      xLabel: 'Tiempo T',
      yLabel: 'Clientes en la cola',
      // Escalones: antes de cada cambio se repite el valor anterior.
      points: queuePoints.flatMap((point, i) =>
        i === 0 ? [point] : [{ x: point.x, y: queuePoints[i - 1]!.y }, point],
      ),
    },
  ];

  return {
    ok: true,
    value: {
      customers,
      events,
      randomNumbers: used,
      supply,
      totalTime,
      averageQueue,
      utilization,
      averageWait,
      averageTimeInSystem,
      maxQueue,
    },
    summary: [
      {
        label: 'Espera promedio en la cola',
        value: String.raw`\bar W_q = ${n(averageWait, 6)}`,
        emphasis: true,
      },
      {
        label: 'Longitud promedio de la cola',
        value: String.raw`\bar L_q = ${n(averageQueue, 6)}`,
      },
      { label: 'Utilización del servidor', value: n(utilization, 6) },
      {
        label: 'Tiempo promedio en el sistema',
        value: String.raw`\bar W = ${n(averageTimeInSystem, 6)}`,
      },
      { label: 'Tiempo simulado', value: `T = ${n(totalTime, 6)}` },
    ],
    ...emptyTrace(),
    steps,
    tables: [
      {
        id: 'clientes',
        title: 'Clientes',
        columns: [
          { key: 'customer', header: String.raw`\text{Cliente}` },
          { key: 'arrival', header: String.raw`\text{Llegada}` },
          { key: 'start', header: String.raw`\text{Inicio del servicio}` },
          { key: 'wait', header: String.raw`\text{Espera}` },
          { key: 'departure', header: String.raw`\text{Salida}` },
        ],
        rows: customers.map((c) => ({ ...c })),
      },
      {
        id: 'eventos',
        title: 'Lista de eventos',
        columns: [
          { key: 'time', header: 'T' },
          { key: 'event', header: String.raw`\text{Evento}`, format: 'text' },
          { key: 'generated', header: String.raw`\text{Números usados}`, format: 'text' },
          { key: 'queue', header: String.raw`\text{Cola}` },
          { key: 'server', header: String.raw`\text{Servidor}`, format: 'text' },
        ],
        rows: eventRows,
      },
    ],
    series,
    notices: [
      {
        level: 'info',
        message: `Se usaron ${used.length} números aleatorios. Una corrida corta es solo una muestra: para estimar las medidas del sistema hay que simular mucho más tiempo o repetir la corrida.`,
      },
      ...(eventSteps.length < events.length
        ? [
            {
              level: 'info' as const,
              message: `Los pasos detallan los primeros ${eventSteps.length} eventos; la tabla de eventos los incluye todos.`,
            },
          ]
        : []),
    ],
  };
}

export const simulation: Calculator<SimulationInput, SimulationValue, SimulationErrorCode> = {
  meta: {
    id: 'simulacion',
    title: 'Simulación',
    summary: 'Simulación manual de una cola con un servidor a partir de números aleatorios.',
    citations: [
      {
        sourceId: 'taha',
        locator: 'Secs. 19.4 y 19.5.1, Ejemplos 19.4-1 y 19.5-1 (10.ª ed.)',
      },
      { sourceId: 'arnold-2001' },
      { sourceId: 'hillier-lieberman-2002', locator: 'Cap. 22, simulación (7.ª ed.)' },
    ],
  },
  inputSchema: simulationInputSchema,
  // Taha, ejemplo 19.5-1: barbería HairKare, llegadas exponenciales de media 15 min y cortes
  // uniformes entre 10 y 15 min; números aleatorios de la columna 1 de la tabla 19.1.
  example: {
    customers: 5,
    arrivalDistribution: 'exponencial',
    arrivalA: 15,
    serviceDistribution: 'uniforme',
    serviceA: 10,
    serviceB: 15,
    source: 'lista',
    numbers: '0.0589 0.6733 0.4799 0.9486 0.6139 0.5933 0.9341 0.1782 0.3473 0.5644',
    seed: 11,
    multiplier: 9,
    increment: 5,
    modulus: 12,
  },
  solve: solveSimulation,
};
