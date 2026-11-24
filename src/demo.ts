import { catalogTable, simulateDay } from "./simulate.ts";
import { toCsv } from "./csv.ts";
import { dateRange } from "./dates.ts";

export interface DemoOptions {
  seed?: number;
  /** Início, YYYY-MM-DD. Padrão: `days` dias terminando em `to`. */
  from?: string;
  /** Fim, YYYY-MM-DD (inclusive). Padrão: ontem em relação a `today`. */
  to?: string;
  /** Janela quando `from` não é dado. Padrão 90. */
  days?: number;
  /** Multiplicador de volume. 1 = loja de porte médio. */
  scale?: number;
  /** "Hoje" (YYYY-MM-DD). Padrão: data atual em UTC. Só afeta as armadilhas e o padrão de `to`. */
  today?: string;
}

export interface DemoTableCsv {
  table: string;
  csv: string;
  rows: number;
}

/** Janela [from, to] resolvida a partir das opções. O dia corrente nunca entra. */
export function demoWindow(opts: DemoOptions = {}): { from: string; to: string; today: string } {
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const to = opts.to ?? new Date(Date.parse(`${today}T00:00:00Z`) - 86_400_000).toISOString().slice(0, 10);
  const days = opts.days ?? 90;
  if (!Number.isInteger(days) || days < 1) throw new Error(`days inválido: ${days}`);
  const from = opts.from ?? new Date(Date.parse(`${to}T00:00:00Z`) - (days - 1) * 86_400_000).toISOString().slice(0, 10);
  return { from, to, today };
}

/**
 * Gera a janela inteira e devolve um CSV por tabela, com todos os dias juntos e cabeçalho sempre.
 * É o que o app carrega no DuckDB (read_csv_auto). Determinístico para o mesmo (seed, janela, today).
 */
export function buildDemoCsvs(opts: DemoOptions = {}): DemoTableCsv[] {
  const seed = opts.seed ?? 42;
  const scale = opts.scale ?? 1;
  if (!Number.isFinite(scale) || scale <= 0) throw new Error(`scale inválido: ${scale}`);
  const { from, to, today } = demoWindow(opts);

  const acc = new Map<string, { columns: readonly string[]; rows: Record<string, string | number | null>[] }>();
  const cat = catalogTable(seed);
  acc.set(cat.table, { columns: cat.columns, rows: cat.rows });

  for (const date of dateRange(from, to, 800)) {
    for (const t of simulateDay(seed, date, { scale, today })) {
      const a = acc.get(t.table) ?? { columns: t.columns, rows: [] };
      for (const r of t.rows) a.rows.push(r);
      acc.set(t.table, a);
    }
  }
  return [...acc].map(([table, a]) => ({ table, csv: toCsv(a.columns, a.rows), rows: a.rows.length }));
}
