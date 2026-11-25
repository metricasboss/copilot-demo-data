import { test } from "node:test";
import assert from "node:assert/strict";
import { simulateDay, TRAPS, type DayTable, type Row } from "../src/simulate.ts";
import { toCsv } from "../src/csv.ts";

const SEED = 42;
const TODAY = "2026-11-23";
const D = "2026-11-10"; // 13 dias antes de TODAY: fora da armadilha A1
const D_TRAP = "2026-11-18"; // 5 dias antes: dentro da A1

const get = (tables: DayTable[], name: string): Row[] => tables.find((t) => t.table === name)!.rows;
const sum = (rows: Row[], k: string): number => rows.reduce((a, r) => a + Number(r[k]), 0);

test("determinístico: mesmo (seed, dia, today) dá exatamente o mesmo resultado", () => {
  const a = simulateDay(SEED, D, { today: TODAY });
  const b = simulateDay(SEED, D, { today: TODAY });
  assert.deepEqual(a, b);
});

test("seed diferente muda os dados", () => {
  const a = get(simulateDay(1, D, { today: TODAY }), "magento_orders");
  const b = get(simulateDay(2, D, { today: TODAY }), "magento_orders");
  assert.notDeepEqual(a, b);
});

test("sem armadilha, o dia não depende de 'hoje'", () => {
  const a = simulateDay(SEED, D, { today: "2026-11-23" });
  const b = simulateDay(SEED, D, { today: "2027-06-01" });
  assert.deepEqual(a, b);
});

test("toda linha tem exatamente as colunas declaradas", () => {
  for (const t of simulateDay(SEED, D, { today: TODAY })) {
    for (const r of t.rows) assert.deepEqual(Object.keys(r).sort(), [...t.columns].sort(), t.table);
  }
});

test("coerência: purchases do GA4 == pedidos do Magento (mesmo transaction_id)", () => {
  const t = simulateDay(SEED, D, { today: TODAY });
  const orders = new Set(get(t, "magento_orders").map((o) => String(o.increment_id)));
  const purchases = get(t, "ga4_events").filter((e) => e.event_name === "purchase");
  const ids = new Set(purchases.map((e) => String(e.transaction_id)));
  assert.ok(orders.size > 20, "esperava dezenas de pedidos num dia comum");
  assert.deepEqual(ids, orders);
  assert.equal(purchases.length, orders.size, "fora da armadilha A1 não há purchase duplicado");
});

test("coerência: total do pedido = itens - desconto + frete, e itens batem com o subtotal", () => {
  const t = simulateDay(SEED, D, { today: TODAY });
  const items = get(t, "magento_order_items");
  for (const o of get(t, "magento_orders")) {
    const rows = items.filter((i) => i.order_id === o.entity_id);
    assert.ok(rows.length >= 1);
    const subtotal = Math.round(sum(rows, "row_total") * 100) / 100;
    assert.equal(subtotal, o.subtotal);
    const grand = Math.round((Number(o.subtotal) - Number(o.discount_amount) + Number(o.shipping_amount)) * 100) / 100;
    assert.equal(grand, o.grand_total);
  }
});

test("coerência: sessões pagas do GA4 = cliques do Ads × taxa de rastreio", () => {
  const t = simulateDay(SEED, D, { today: TODAY });
  const starts = get(t, "ga4_events").filter((e) => e.event_name === "session_start" && e.traffic_source_medium === "cpc");
  const clicks = sum(get(t, "ads_campaign_stats"), "clicks");
  const ratio = starts.length / clicks;
  assert.ok(ratio > 0.92 && ratio < 0.96, `razão ${ratio}`);
});

test("verdade conhecida: pedidos e receita por canal somam o total do Magento", () => {
  const t = simulateDay(SEED, D, { today: TODAY });
  const truth = get(t, "truth_daily_channel");
  assert.equal(sum(truth, "orders"), get(t, "magento_orders").length);
  const rev = Math.round(sum(truth, "revenue") * 100) / 100;
  assert.equal(rev, Math.round(sum(get(t, "magento_orders"), "grand_total") * 100) / 100);
});

test("Ads declara menos conversões que a verdade (captura < 100%)", () => {
  const t = simulateDay(SEED, D, { today: TODAY });
  const ads = sum(get(t, "ads_campaign_stats"), "conversions");
  const truthPaid = get(t, "truth_daily_channel")
    .filter((r) => String(r.channel).startsWith("google_"))
    .reduce((a, r) => a + Number(r.orders), 0);
  assert.ok(ads < truthPaid);
});

test("armadilha A1: purchase duplicado só nos últimos N dias", () => {
  const inside = simulateDay(SEED, D_TRAP, { today: TODAY });
  const purchases = get(inside, "ga4_events").filter((e) => e.event_name === "purchase");
  const orders = get(inside, "magento_orders").length;
  assert.equal(purchases.length, orders * 2);
  assert.equal(new Set(purchases.map((e) => e.transaction_id)).size, orders);

  const edge = simulateDay(SEED, "2026-11-11", { today: TODAY }); // exatamente N dias antes
  assert.equal(TRAPS.A1_DUPLICATE_PURCHASE_DAYS, 12);
  assert.equal(get(edge, "ga4_events").filter((e) => e.event_name === "purchase").length, get(edge, "magento_orders").length * 2);

  const outside = simulateDay(SEED, "2026-11-10", { today: TODAY });
  assert.equal(get(outside, "ga4_events").filter((e) => e.event_name === "purchase").length, get(outside, "magento_orders").length);
});

test("o dia corrente nunca é marcado como armadilha (daysAgo 0)", () => {
  const t = simulateDay(SEED, TODAY, { today: TODAY });
  assert.equal(get(t, "ga4_events").filter((e) => e.event_name === "purchase").length, get(t, "magento_orders").length);
});

test("Black Friday vende bem mais que um período comum", () => {
  const avg = (days: string[]): number =>
    days.reduce((a, d) => a + get(simulateDay(SEED, d, { today: "2027-01-01" }), "magento_orders").length, 0) / days.length;
  const bf = avg(["2026-11-26", "2026-11-27"]);
  const normal = avg(["2026-09-15", "2026-09-16", "2026-09-17"]);
  assert.ok(bf > normal * 1.8, `bf=${bf} normal=${normal}`);
});

test("PII sintética: domínios reservados, CPF com dígitos inválidos, celular 90xxx", () => {
  const orders = get(simulateDay(SEED, D, { today: TODAY }), "magento_orders");
  for (const o of orders) {
    assert.match(String(o.customer_email), /@example\.(com|org|net)$/);
    assert.match(String(o.shipping_telephone), /^\(\d{2}\) 90\d{3}-\d{4}$/);
    assert.match(String(o.shipping_postcode), /^\d{5}-\d{3}$/);
    const cpf = String(o.customer_taxvat).replace(/\D/g, "");
    assert.equal(cpf.length, 11);
    assert.ok(!cpfValid(cpf), `CPF não pode ser válido: ${cpf}`);
  }
});

test("clientes recorrentes existem (mesmo customer_id em dias diferentes)", () => {
  const seen = new Map<number, number>();
  for (const d of ["2026-10-01", "2026-10-02", "2026-10-03", "2026-10-04", "2026-10-05"]) {
    for (const o of get(simulateDay(SEED, d, { today: TODAY }), "magento_orders")) {
      seen.set(Number(o.customer_id), (seen.get(Number(o.customer_id)) ?? 0) + 1);
    }
  }
  assert.ok([...seen.values()].some((n) => n > 1));
});

test("CSV: cabeçalho sempre, aspas e vírgulas escapadas, vazio vira célula vazia", () => {
  assert.equal(toCsv(["a", "b"], []), "a,b\n");
  assert.equal(toCsv(["a", "b"], [{ a: 'x,"y"', b: null }]), 'a,b\n"x,""y""",\n');
});

test("scale multiplica o volume", () => {
  const small = get(simulateDay(SEED, D, { today: TODAY, scale: 0.2 }), "ga4_events").length;
  const big = get(simulateDay(SEED, D, { today: TODAY, scale: 1 }), "ga4_events").length;
  assert.ok(big > small * 3);
});

function cpfValid(d: string): boolean {
  if (/^(\d)\1+$/.test(d)) return false;
  const dv = (n: number): number => {
    let s = 0;
    for (let i = 0; i < n; i++) s += Number(d[i]) * (n + 1 - i);
    const r = (s * 10) % 11;
    return r === 10 ? 0 : r;
  };
  return dv(9) === Number(d[9]) && dv(10) === Number(d[10]);
}

test("recompra realista: sem 'baleias' (a maioria compra uma vez, ninguém compra quase todo dia)", () => {
  const porCliente = new Map<number, number>();
  const hoje = "2027-01-01";
  for (let i = 0; i < 60; i++) {
    const d = new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10);
    for (const o of get(simulateDay(SEED, d, { today: hoje }), "magento_orders")) {
      porCliente.set(Number(o.customer_id), (porCliente.get(Number(o.customer_id)) ?? 0) + 1);
    }
  }
  const contagens = [...porCliente.values()];
  const clientes = contagens.length;
  const unico = contagens.filter((n) => n === 1).length / clientes;
  const cinco = contagens.filter((n) => n >= 5).length;
  const maximo = Math.max(...contagens);
  assert.ok(clientes > 3000, `poucos clientes distintos: ${clientes}`);
  assert.ok(unico >= 0.75, `só ${(unico * 100).toFixed(0)}% compraram uma vez`);
  assert.ok(maximo <= 12, `um cliente com ${maximo} pedidos em 60 dias é irreal`);
  assert.ok(cinco / clientes <= 0.03, `${cinco} clientes com 5+ pedidos (${((cinco / clientes) * 100).toFixed(1)}%)`);
  assert.ok(contagens.some((n) => n > 1), "mas ainda existem clientes recorrentes");
});

test("nenhuma tabela tem coluna chamada exatamente 'name' (a fronteira de PII do app a trata como nome de pessoa)", () => {
  const colunas = simulateDay(SEED, D, { today: TODAY }).flatMap((t) => t.columns.map((c) => `${t.table}.${c}`));
  const e = colunas.filter((c) => c.endsWith(".name"));
  assert.deepEqual(e, [], `renomeie para <entidade>_name: ${e.join(", ")}`);
});

test("magento_products e magento_order_items expõem product_name, legível", () => {
  const t = simulateDay(SEED, D, { today: TODAY });
  const itens = get(t, "magento_order_items");
  assert.ok(itens.length > 0);
  assert.equal(typeof itens[0]!.product_name, "string");
  assert.ok(String(itens[0]!.product_name).length > 3);
  assert.ok(!("name" in itens[0]!));
});
