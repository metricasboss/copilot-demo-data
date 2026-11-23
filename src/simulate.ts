/** Uma tabela de saída de um dia simulado. */
export interface DayTable {
  /** Nome lógico (ex.: "ga4_events"). Vira o nome do arquivo NDJSON. */
  table: string;
  /** Destino no BigQuery: "events_20261122" (fragmentada) ou "ads_Campaign$20261122" (partição). */
  destination: string;
  /** Caminho do schema JSON, relativo a bq/schemas/. */
  schema: string;
  rows: Record<string, unknown>[];
}

/**
 * Gera todas as tabelas de um dia. Determinística: o mesmo (seed, date) dá sempre o mesmo resultado.
 * TODO(feat/simulate-day): modelo causal em docs/ARQUITETURA.md.
 * Lança de propósito: a pipeline não deve carregar tabelas vazias como se fossem dados.
 */
export function simulateDay(_seed: number, _date: string): DayTable[] {
  throw new Error("simulateDay ainda não implementado (ver docs/ARQUITETURA.md)");
}
