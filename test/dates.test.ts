import { test } from "node:test";
import assert from "node:assert/strict";
import { dateRange, yesterdayUtc, assertIsoDate } from "../src/dates.ts";
import { assertDestination, assertProject, assertDataset } from "../src/bq-names.ts";

test("yesterdayUtc usa UTC, inclusive na virada de mês e ano", () => {
  assert.equal(yesterdayUtc(new Date("2026-11-23T02:00:00Z")), "2026-11-22");
  assert.equal(yesterdayUtc(new Date("2027-01-01T00:00:00Z")), "2026-12-31");
  assert.equal(yesterdayUtc(new Date("2028-03-01T10:00:00Z")), "2028-02-29");
});

test("dateRange é inclusivo e ordenado", () => {
  assert.deepEqual(dateRange("2026-11-29", "2026-12-01"), ["2026-11-29", "2026-11-30", "2026-12-01"]);
  assert.deepEqual(dateRange("2026-11-23", "2026-11-23"), ["2026-11-23"]);
});

test("dateRange rejeita invertido, formato ruim e intervalo gigante", () => {
  assert.throws(() => dateRange("2026-11-23", "2026-11-22"), /invertido/);
  assert.throws(() => assertIsoDate("23/11/2026"), /inválida/);
  assert.throws(() => assertIsoDate("2026-13-45"), /inválida/);
  assert.throws(() => dateRange("2020-01-01", "2026-11-23"), /grande demais/);
});

test("nomes do BigQuery: aceita tabela e partição, rejeita injeção", () => {
  assert.equal(assertDestination("events_20261122"), "events_20261122");
  assert.equal(assertDestination("ads_Campaign$20261122"), "ads_Campaign$20261122");
  for (const bad of ["a b", "x;rm -rf /", "t$2026", "$20261122", "a`b", ""]) {
    assert.throws(() => assertDestination(bad));
  }
  assert.equal(assertProject("copilot-demo-123"), "copilot-demo-123");
  assert.throws(() => assertProject("Bad_Project"));
  assert.throws(() => assertDataset("demo-store"));
  assert.equal(assertDataset("demo_store"), "demo_store");
});
