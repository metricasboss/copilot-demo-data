/**
 * Calendário comercial brasileiro. A sazonalidade vem do calendário de verdade,
 * então a demo de hoje mostra a Black Friday de hoje, não a de 2021.
 * Datas em UTC, formato ISO "YYYY-MM-DD".
 */

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function utc(year: number, month1: number, day: number): Date {
  return new Date(Date.UTC(year, month1 - 1, day));
}

/** n-ésimo dia da semana (0=domingo) de um mês. */
function nthWeekday(year: number, month1: number, weekday: number, n: number): Date {
  const first = utc(year, month1, 1);
  const offset = (weekday - first.getUTCDay() + 7) % 7;
  return utc(year, month1, 1 + offset + (n - 1) * 7);
}

function addDays(d: Date, days: number): Date {
  return new Date(d.getTime() + days * 86_400_000);
}

export interface CommercialEvent {
  name: string;
  date: string;
  /** Quantos dias antes a demanda já sobe. */
  rampDays: number;
  /** Multiplicador de pico sobre a base. */
  lift: number;
}

export function commercialEvents(year: number): CommercialEvent[] {
  const thanksgiving = nthWeekday(year, 11, 4, 4); // 4ª quinta de novembro
  return [
    { name: "Dia do Consumidor", date: isoDate(utc(year, 3, 15)), rampDays: 2, lift: 1.5 },
    { name: "Dia das Mães", date: isoDate(nthWeekday(year, 5, 0, 2)), rampDays: 7, lift: 1.7 },
    { name: "Dia dos Namorados", date: isoDate(utc(year, 6, 12)), rampDays: 5, lift: 1.5 },
    { name: "Dia dos Pais", date: isoDate(nthWeekday(year, 8, 0, 2)), rampDays: 5, lift: 1.4 },
    { name: "Black Friday", date: isoDate(addDays(thanksgiving, 1)), rampDays: 6, lift: 3.2 },
    { name: "Natal", date: isoDate(utc(year, 12, 25)), rampDays: 10, lift: 1.9 },
  ];
}

/** Fator de demanda de um dia: sazonalidade semanal + eventos comerciais. */
export function demandFactor(date: string): number {
  const d = new Date(`${date}T00:00:00Z`);
  const weekday = [0.92, 1.0, 1.03, 1.02, 1.0, 0.95, 0.88][d.getUTCDay()]!;
  let event = 1;
  for (const y of [d.getUTCFullYear(), d.getUTCFullYear() + 1]) {
    for (const e of commercialEvents(y)) {
      const diff = (new Date(`${e.date}T00:00:00Z`).getTime() - d.getTime()) / 86_400_000;
      if (diff >= 0 && diff <= e.rampDays) {
        const ramp = 1 + (e.lift - 1) * (1 - diff / (e.rampDays + 1));
        event = Math.max(event, ramp);
      } else if (diff < 0 && diff >= -1) {
        event = Math.max(event, 1 + (e.lift - 1) * 0.5); // ressaca do dia seguinte
      }
    }
  }
  return weekday * event;
}
