import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { catalogTable, simulateDay } from "../src/simulate.ts";
import { schemaFor } from "../src/schemas.ts";

/** Gera bq/schemas/<tabela>.json a partir das colunas declaradas. Rode depois de mudar uma tabela. */
const dir = "bq/schemas";
mkdirSync(dir, { recursive: true });
for (const t of [...simulateDay(42, "2026-01-05", { today: "2026-01-20" }), catalogTable(42)]) {
  writeFileSync(join(dir, `${t.table}.json`), JSON.stringify(schemaFor(t), null, 2) + "\n");
  console.log(`bq/schemas/${t.table}.json (${t.columns.length} colunas)`);
}
