import { normal, type Rng } from "./prng.ts";

export const round2 = (n: number): number => Math.round(n * 100) / 100;
export const round1 = (n: number): number => Math.round(n * 10) / 10;

/** Ruído multiplicativo log-normal, média ~1. */
export function logn(rng: Rng, sd: number): number {
  return Math.exp(normal(rng, 0, sd));
}

export function pick<T>(rng: Rng, items: readonly T[]): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function pickWeighted<T>(rng: Rng, items: readonly T[], weights: readonly number[]): T {
  let total = 0;
  for (const w of weights) total += w;
  let r = rng() * total;
  for (let i = 0; i < items.length; i++) {
    r -= weights[i]!;
    if (r <= 0) return items[i]!;
  }
  return items[items.length - 1]!;
}

/** Até `n` índices distintos de [0, size), sem repetição. */
export function sampleIndices(rng: Rng, size: number, n: number): number[] {
  const k = Math.min(n, size);
  const idx = Array.from({ length: size }, (_, i) => i);
  for (let i = 0; i < k; i++) {
    const j = i + Math.floor(rng() * (size - i));
    [idx[i], idx[j]] = [idx[j]!, idx[i]!];
  }
  return idx.slice(0, k);
}

export const clamp = (n: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, n));
