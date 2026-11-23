// Smoke do pacote compilado: é o que o app realmente importa. Rode `npm run build` antes.
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync } from "node:fs";

test("dist exporta a API pública e gera dados", async () => {
  assert.ok(existsSync(new URL("../dist/index.js", import.meta.url)), "rode `npm run build` antes dos testes");
  const m = await import("../dist/index.js");
  for (const k of ["buildDemoCsvs", "demoWindow", "simulateDay", "toCsv", "schemaFor"]) {
    assert.equal(typeof m[k], "function", k);
  }
  const out = m.buildDemoCsvs({ today: "2026-11-23", days: 1, scale: 0.05 });
  assert.ok(out.find((o) => o.table === "magento_orders").rows > 0);
});
