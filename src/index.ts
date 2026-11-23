// API pública. O app (sidecar) usa `buildDemoCsvs`; o resto é para quem quiser ir mais fundo.
export { buildDemoCsvs, demoWindow } from "./demo.ts";
export type { DemoOptions, DemoTableCsv } from "./demo.ts";
export { simulateDay, catalogTable, CHANNELS, TRAPS } from "./simulate.ts";
export type { DayTable, Row, SimOptions } from "./simulate.ts";
export { toCsv, toNdjson } from "./csv.ts";
export { dateRange, yesterdayUtc } from "./dates.ts";
export { schemaFor } from "./schemas.ts";
export { commercialEvents, demandFactor } from "./calendar.ts";
export { rngFor, mulberry32, hash32 } from "./prng.ts";
export type { Rng } from "./prng.ts";
