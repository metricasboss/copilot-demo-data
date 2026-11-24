import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { catalogTable, simulateDay } from "../src/simulate.ts";
import { schemaFor } from "../src/schemas.ts";

const tables = [...simulateDay(42, "2026-01-05", { today: "2026-01-20" }), catalogTable(42)];

test("toda tabela tem schema, com as mesmas colunas e na mesma ordem", () => {
  for (const t of tables) {
    assert.deepEqual(schemaFor(t).map((f) => f.name), [...t.columns], t.table);
  }
});

test("os arquivos em bq/schemas estão em dia (rode: node scripts/gen-schemas.ts)", () => {
  for (const t of tables) {
    const onDisk = JSON.parse(readFileSync(`bq/schemas/${t.table}.json`, "utf8"));
    assert.deepEqual(onDisk, schemaFor(t), `${t.table}.json desatualizado`);
  }
});

test("o campo schema de cada DayTable aponta para um arquivo que existe", () => {
  for (const t of tables) {
    assert.doesNotThrow(() => readFileSync(`bq/schemas/${t.schema}`, "utf8"), t.schema);
  }
});

test("números não-inteiros nunca ficam em colunas INTEGER", () => {
  const days = ["2026-01-05", "2026-01-06"].flatMap((d) => simulateDay(42, d, { today: "2026-01-20" }));
  for (const t of days) {
    const types = Object.fromEntries(schemaFor(t).map((f) => [f.name, f.type]));
    for (const r of t.rows) {
      for (const [k, v] of Object.entries(r)) {
        if (types[k] === "INTEGER" && v !== null) assert.ok(Number.isInteger(v), `${t.table}.${k}=${v}`);
      }
    }
  }
});
