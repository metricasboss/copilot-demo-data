/**
 * PRNG determinístico. Tudo que o gerador sorteia sai de `rngFor(seed, ...chaves)`,
 * nunca de Math.random(): o mesmo (seed, data, entidade) dá sempre o mesmo número,
 * então o dia 10/11 é igual em toda abertura do app e em todo job do BigQuery.
 */

/** Hash de string de 32 bits (FNV-1a). */
export function hash32(input: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** mulberry32: gerador pequeno e rápido, suficiente para dados simulados. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export type Rng = () => number;

/** RNG independente por contexto, ex.: rngFor(42, "2026-11-23", "google-ads", "sessions"). */
export function rngFor(seed: number, ...keys: (string | number)[]): Rng {
  return mulberry32(hash32(`${seed}|${keys.join("|")}`));
}

/** Aproximação de normal (Box-Muller) a partir de um Rng uniforme. */
export function normal(rng: Rng, mean = 0, sd = 1): number {
  const u = Math.max(rng(), Number.EPSILON);
  const v = rng();
  return mean + sd * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}

/** Poisson por Knuth; para lambdas grandes usa aproximação normal. */
export function poisson(rng: Rng, lambda: number): number {
  if (lambda <= 0) return 0;
  if (lambda > 50) return Math.max(0, Math.round(normal(rng, lambda, Math.sqrt(lambda))));
  const limit = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > limit);
  return k - 1;
}
