import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dateRange, yesterdayUtc } from "./dates.ts";
import { simulateDay } from "./simulate.ts";

/**
 * Uso: node src/cli.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out DIR] [--seed N]
 * Sem --from/--to, gera só ontem (UTC). Escreve NDJSON por tabela e um manifest.json.
 */
function parseArgs(argv: string[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (let i = 0; i < argv.length; i += 2) {
    const k = argv[i];
    const v = argv[i + 1];
    if (!k?.startsWith("--") || v === undefined) throw new Error(`Argumento inválido perto de "${k ?? ""}"`);
    out[k.slice(2)] = v;
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
const to = args.to || yesterdayUtc();
const from = args.from || to;
const outDir = args.out || "out";
const seed = Number(args.seed ?? 42);
if (!Number.isInteger(seed)) throw new Error(`--seed inválido: "${args.seed}"`);

const manifest: { date: string; table: string; destination: string; schema: string; file: string; rows: number }[] = [];

for (const date of dateRange(from, to)) {
  const dir = join(outDir, date);
  mkdirSync(dir, { recursive: true });
  for (const t of simulateDay(seed, date)) {
    const file = join(dir, `${t.table}.ndjson`);
    writeFileSync(file, t.rows.map((r) => JSON.stringify(r)).join("\n") + (t.rows.length ? "\n" : ""));
    manifest.push({ date, table: t.table, destination: t.destination, schema: t.schema, file, rows: t.rows.length });
  }
}

mkdirSync(outDir, { recursive: true });
writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
console.log(`Gerado ${from}..${to}: ${manifest.length} arquivos, ${manifest.reduce((n, m) => n + m.rows, 0)} linhas em ${outDir}/`);
