const ISO = /^\d{4}-\d{2}-\d{2}$/;

export function assertIsoDate(s: string): string {
  if (!ISO.test(s) || Number.isNaN(Date.parse(`${s}T00:00:00Z`))) {
    throw new Error(`Data inválida: "${s}" (use YYYY-MM-DD)`);
  }
  return s;
}

/** Ontem em UTC. O dia corrente nunca é gerado, para não existir dia parcial. */
export function yesterdayUtc(now: Date = new Date()): string {
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() - 1));
  return d.toISOString().slice(0, 10);
}

/** Datas de `from` a `to`, inclusivas. Limite de 800 dias para um typo não gerar anos de dados. */
export function dateRange(from: string, to: string, maxDays = 800): string[] {
  assertIsoDate(from);
  assertIsoDate(to);
  const start = Date.parse(`${from}T00:00:00Z`);
  const end = Date.parse(`${to}T00:00:00Z`);
  if (end < start) throw new Error(`Intervalo invertido: ${from}..${to}`);
  const days = (end - start) / 86_400_000 + 1;
  if (days > maxDays) throw new Error(`Intervalo grande demais: ${days} dias (máximo ${maxDays})`);
  return Array.from({ length: days }, (_, i) => new Date(start + i * 86_400_000).toISOString().slice(0, 10));
}
