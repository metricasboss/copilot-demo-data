export { hash32, mulberry32, rngFor, normal, poisson } from "./prng.ts";
export type { Rng } from "./prng.ts";
export { commercialEvents, demandFactor, isoDate } from "./calendar.ts";
export type { CommercialEvent } from "./calendar.ts";

// TODO(fase 1): simulateDay(seed, date) -> { sessions, orders, adsStats, gscRows }
//   modelo causal em docs/ARQUITETURA.md. Cada exporter (ga4, ads, gsc, magento) lê o
//   resultado da mesma simulação, para os joins entre fontes baterem.
