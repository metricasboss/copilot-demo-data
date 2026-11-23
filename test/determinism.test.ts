import { test } from "node:test";
import assert from "node:assert/strict";
import { rngFor, poisson } from "../src/prng.ts";
import { commercialEvents, demandFactor } from "../src/calendar.ts";

test("mesmo (seed, chaves) dá a mesma sequência", () => {
  const a = rngFor(42, "2026-11-10", "google-ads");
  const b = rngFor(42, "2026-11-10", "google-ads");
  for (let i = 0; i < 20; i++) assert.equal(a(), b());
});

test("chaves diferentes dão sequências independentes", () => {
  assert.notEqual(rngFor(42, "2026-11-10")(), rngFor(42, "2026-11-11")());
  assert.notEqual(rngFor(1, "x")(), rngFor(2, "x")());
});

test("poisson tem média próxima do lambda", () => {
  const rng = rngFor(7, "poisson");
  const n = 5000;
  let sum = 0;
  for (let i = 0; i < n; i++) sum += poisson(rng, 12);
  assert.ok(Math.abs(sum / n - 12) < 0.5);
});

test("Black Friday de 2026 cai em 27/11", () => {
  const bf = commercialEvents(2026).find((e) => e.name === "Black Friday");
  assert.equal(bf?.date, "2026-11-27");
});

test("demanda na Black Friday é bem maior que numa terça comum", () => {
  assert.ok(demandFactor("2026-11-27") > 2.5 * demandFactor("2026-09-15"));
});
