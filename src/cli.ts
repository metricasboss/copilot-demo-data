import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { dateRange, yesterdayUtc } from "./dates.ts";
import { catalogTable, simulateDay, type DayTable, type Row } from "./simulate.ts";
import { toCsv, toNdjson } from "./csv.ts";

/**
 * Uso: node src/cli.ts [--from YYYY-MM-DD] [--to YYYY-MM-DD] [--out DIR] [--seed N]
 *                      [--format ndjson|csv] [--merge true|false] [--scale N]
 * Sem --from/--to, gera só ontem (UTC).
 *   --merge true : um arquivo por tabela com todos os dias (bom para importar no app). Só com --format csv.
 *   --merge false: um arquivo por tabela e dia + manifest.json (usado pela carga no BigQuery).
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
const scale = Number(args.scale ?? 1);
const format = args.format ?? "ndjson";
const merge = (args.merge ?? "false") === "true";
if (!Number.isInteger(seed)) throw new Error(`--seed inválido: "${args.seed}"`);
if (!Number.isFinite(scale) || scale <= 0) throw new Error(`--scale inválido: "${args.scale}"`);
if (format !== "ndjson" && format !== "csv") throw new Error(`--format inválido: "${format}"`);
if (merge && format !== "csv") throw new Error("--merge true exige --format csv");

const ext = format === "csv" ? "csv" : "ndjson";
const serialize = (t: Pick<DayTable, "columns" | "rows">): string => (format === "csv" ? toCsv(t.columns, t.rows) : toNdjson(t.rows));

mkdirSync(outDir, { recursive: true });
const today = new Date().toISOString().slice(0, 10);
const manifest: { date: string; table: string; destination: string; schema: string; file: string; rows: number }[] = [];
const merged = new Map<string, { columns: readonly string[]; rows: Row[] }>();

const catalog = catalogTable(seed);
if (merge) {
  merged.set(catalog.table, { columns: catalog.columns, rows: [...catalog.rows] });
} else {
  mkdirSync(join(outDir, "static"), { recursive: true });
  const file = join(outDir, "static", `${catalog.table}.${ext}`);
  writeFileSync(file, serialize(catalog));
  manifest.push({ date: "static", table: catalog.table, destination: catalog.destination, schema: catalog.schema, file, rows: catalog.rows.length });
}

for (const date of dateRange(from, to)) {
  for (const t of simulateDay(seed, date, { scale, today })) {
    if (merge) {
      const acc = merged.get(t.table) ?? { columns: t.columns, rows: [] };
      for (const r of t.rows) acc.rows.push(r);
      merged.set(t.table, acc);
    } else {
      const dir = join(outDir, date);
      mkdirSync(dir, { recursive: true });
      const file = join(dir, `${t.table}.${ext}`);
      writeFileSync(file, serialize(t));
      manifest.push({ date, table: t.table, destination: t.destination, schema: t.schema, file, rows: t.rows.length });
    }
  }
}

if (merge) {
  let total = 0;
  for (const [table, acc] of merged) {
    writeFileSync(join(outDir, `${table}.csv`), toCsv(acc.columns, acc.rows));
    total += acc.rows.length;
    console.log(`  ${table}.csv: ${acc.rows.length} linhas`);
  }
  console.log(`Gerado ${from}..${to} em ${outDir}/ (${merged.size} arquivos, ${total} linhas)`);
} else {
  writeFileSync(join(outDir, "manifest.json"), JSON.stringify(manifest, null, 2));
  console.log(`Gerado ${from}..${to}: ${manifest.length} arquivos, ${manifest.reduce((n, m) => n + m.rows, 0)} linhas em ${outDir}/`);
}
