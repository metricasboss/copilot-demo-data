import { test } from "node:test";
import assert from "node:assert/strict";
import { buildDemoCsvs, demoWindow } from "../src/demo.ts";

const TODAY = "2026-11-23";

test("janela padrão: 90 dias terminando ontem, sem o dia corrente", () => {
  const w = demoWindow({ today: TODAY });
  assert.equal(w.to, "2026-11-22");
  assert.equal(w.from, "2026-08-25");
});

test("janela respeita from/to/days explícitos e rejeita days inválido", () => {
  assert.deepEqual(demoWindow({ today: TODAY, days: 3 }), { from: "2026-11-20", to: "2026-11-22", today: TODAY });
  assert.deepEqual(demoWindow({ today: TODAY, from: "2026-11-01", to: "2026-11-05" }), { from: "2026-11-01", to: "2026-11-05", today: TODAY });
  assert.throws(() => demoWindow({ today: TODAY, days: 0 }), /days inválido/);
});

test("buildDemoCsvs: um CSV por tabela, com cabeçalho e linhas de todos os dias", () => {
  const out = buildDemoCsvs({ today: TODAY, days: 3, scale: 0.1 });
  const names = out.map((o) => o.table).sort();
  assert.deepEqual(names, ["ads_campaign_stats", "ga4_events", "magento_creditmemos", "magento_order_items", "magento_orders", "magento_products", "truth_daily_channel"]);
  for (const o of out) {
    const lines = o.csv.trimEnd().split("\n");
    assert.equal(lines.length - 1, o.rows, o.table);
  }
  assert.equal(out.find((o) => o.table === "ads_campaign_stats")!.rows, 3 * 3); // 3 dias x 3 campanhas
  assert.equal(out.find((o) => o.table === "truth_daily_channel")!.rows, 3 * 6); // 3 dias x 6 canais
});

test("buildDemoCsvs é determinístico", () => {
  const a = buildDemoCsvs({ today: TODAY, days: 2, scale: 0.1 });
  const b = buildDemoCsvs({ today: TODAY, days: 2, scale: 0.1 });
  assert.deepEqual(a, b);
});

test("buildDemoCsvs rejeita scale inválido", () => {
  assert.throws(() => buildDemoCsvs({ today: TODAY, scale: 0 }), /scale inválido/);
});
