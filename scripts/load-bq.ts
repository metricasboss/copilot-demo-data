import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { assertDataset, assertDestination, assertProject } from "../src/bq-names.ts";

/**
 * Carrega o manifest.json gerado por src/cli.ts no BigQuery com `bq load --replace`
 * (load job: gratuito). Idempotente: refazer um dia substitui só aquela tabela/partição.
 * Env: BQ_PROJECT, BQ_DATASET, opcionais OUT_DIR (padrão "out") e DRY_RUN=1.
 *
 * Não testado contra um BigQuery real ainda: validar com DRY_RUN=1 e depois um dia só.
 */
const project = assertProject(process.env.BQ_PROJECT ?? "");
const dataset = assertDataset(process.env.BQ_DATASET ?? "");
const outDir = process.env.OUT_DIR || "out";
const dry = process.env.DRY_RUN === "1";

interface Entry { date: string; table: string; destination: string; schema: string; file: string; rows: number }
const manifest: Entry[] = JSON.parse(readFileSync(join(outDir, "manifest.json"), "utf8"));

let loaded = 0;
for (const e of manifest) {
  assertDestination(e.destination);
  if (e.rows === 0) {
    console.log(`- ${e.destination}: 0 linhas, pulando`);
    continue;
  }
  const schema = join("bq", "schemas", e.schema);
  if (!existsSync(schema)) throw new Error(`Schema não encontrado: ${schema}`);
  const args = [
    "load",
    "--source_format=NEWLINE_DELIMITED_JSON",
    "--replace",
    `--project_id=${project}`,
    ...(e.destination.includes("$") ? ["--time_partitioning_type=DAY"] : []),
    `${dataset}.${e.destination}`,
    e.file,
    schema,
  ];
  console.log(`${dry ? "[dry-run] " : ""}bq ${args.join(" ")}`);
  if (!dry) {
    const r = spawnSync("bq", args, { stdio: "inherit" });
    if (r.status !== 0) throw new Error(`bq load falhou para ${e.destination} (status ${r.status})`);
  }
  loaded++;
}
console.log(`${dry ? "Simulado" : "Carregado"}: ${loaded} de ${manifest.length} entradas.`);
