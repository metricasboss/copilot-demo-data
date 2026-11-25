import { hash32, rngFor } from "./prng.ts";
import { logn, pick, pickWeighted, round2 } from "./util.ts";

/**
 * Catálogo e clientes FICTÍCIOS. Nada aqui é dado real:
 * - e-mails usam domínios reservados (example.com/.org/.net);
 * - CPFs têm formato válido mas dígitos verificadores propositalmente ERRADOS, para nunca
 *   coincidirem com o CPF de uma pessoa real e ainda assim exercitarem a redação por formato;
 * - celulares usam o prefixo "90", que não é atribuído.
 */

export interface Product {
  sku: string;
  name: string;
  category: string;
  price: number;
  cost: number;
  /** Peso de popularidade, usado ao sortear itens de pedido. */
  weight: number;
}

const CATEGORIES = [
  { name: "Tênis", weight: 0.24, price: [229, 649], margin: 0.52, nouns: ["Corrida", "Casual", "Trail", "Urbano", "Treino"] },
  { name: "Camisetas", weight: 0.3, price: [59, 149], margin: 0.62, nouns: ["Básica", "Dry Fit", "Estampada", "Regata", "Polo"] },
  { name: "Bermudas e Shorts", weight: 0.16, price: [79, 189], margin: 0.58, nouns: ["Treino", "Praia", "Corrida", "Casual"] },
  { name: "Mochilas", weight: 0.1, price: [129, 349], margin: 0.55, nouns: ["Urbana", "Esportiva", "Viagem"] },
  { name: "Acessórios", weight: 0.2, price: [29, 119], margin: 0.65, nouns: ["Garrafa", "Boné", "Meia", "Munhequeira", "Toalha"] },
] as const;

const LINES = ["Aero", "Pulse", "Nova", "Terra", "Flex", "Rio", "Atlas", "Vento", "Onda", "Pico"];
const COLORS = ["Preto", "Branco", "Azul", "Verde", "Cinza", "Vermelho", "Areia"];

const catalogCache = new Map<number, Product[]>();

export function buildCatalog(seed: number): Product[] {
  const cached = catalogCache.get(seed);
  if (cached) return cached;
  const rng = rngFor(seed, "catalog");
  const out: Product[] = [];
  let n = 1;
  for (const cat of CATEGORIES) {
    const count = Math.round(cat.weight * 50);
    for (let i = 0; i < count; i++) {
      const [lo, hi] = cat.price;
      const price = Math.floor(lo + (hi - lo) * Math.pow(rng(), 1.4)) + 0.9;
      out.push({
        sku: `SKU-${String(n).padStart(4, "0")}`,
        name: `${pick(rng, cat.nouns)} ${pick(rng, LINES)} ${pick(rng, COLORS)}`,
        category: cat.name,
        price: round2(price),
        cost: round2(price * (1 - cat.margin) * logn(rng, 0.05)),
        weight: cat.weight * logn(rng, 0.7),
      });
      n++;
    }
  }
  catalogCache.set(seed, out);
  return out;
}

// ---- Clientes -----------------------------------------------------------------------------

const FIRST = ["Ana", "Bruno", "Camila", "Daniel", "Eduarda", "Felipe", "Gabriela", "Henrique", "Isabela", "João", "Karina", "Lucas", "Mariana", "Nicolas", "Olívia", "Pedro", "Rafaela", "Sofia", "Thiago", "Vitória", "Alice", "Bernardo", "Carla", "Diego", "Elisa", "Fernando", "Giovana", "Heitor", "Júlia", "Leonardo"];
const LAST = ["Almeida", "Barbosa", "Cardoso", "Dias", "Ferreira", "Gomes", "Lima", "Machado", "Nunes", "Oliveira", "Pereira", "Ramos", "Santos", "Teixeira", "Vieira", "Araújo", "Castro", "Moreira", "Rocha", "Silva"];
const CITIES = [
  { city: "São Paulo", region: "SP", ddd: 11, cep: "01" },
  { city: "Rio de Janeiro", region: "RJ", ddd: 21, cep: "20" },
  { city: "Belo Horizonte", region: "MG", ddd: 31, cep: "30" },
  { city: "Curitiba", region: "PR", ddd: 41, cep: "80" },
  { city: "Porto Alegre", region: "RS", ddd: 51, cep: "90" },
  { city: "Salvador", region: "BA", ddd: 71, cep: "40" },
  { city: "Recife", region: "PE", ddd: 81, cep: "50" },
  { city: "Fortaleza", region: "CE", ddd: 85, cep: "60" },
  { city: "Brasília", region: "DF", ddd: 61, cep: "70" },
  { city: "Goiânia", region: "GO", ddd: 62, cep: "74" },
] as const;
const CITY_WEIGHTS = [30, 14, 8, 7, 6, 6, 5, 4, 5, 3];
const DOMAINS = ["example.com", "example.org", "example.net"];

/** Clientes novos e ocasionais (ids acima de LOYAL_POOL): quase todos compram uma vez só. */
export const CUSTOMER_POOL = 60_000;
/** Clientes fiéis (ids 1..LOYAL_POOL): ~10% dos pedidos, espalhados, então poucos pedidos cada um (sem "baleias"). */
export const LOYAL_POOL = 400;
export const LOYAL_SHARE = 0.1;

export interface Customer {
  id: number;
  firstname: string;
  lastname: string;
  email: string;
  taxvat: string;
  phone: string;
  postcode: string;
  city: string;
  region: string;
}

const slug = (s: string): string => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

function fakeCpf(rng: () => number, formatted: boolean): string {
  const d = Array.from({ length: 9 }, () => Math.floor(rng() * 10));
  const dv = (digits: number[]): number => {
    const sum = digits.reduce((acc, v, i) => acc + v * (digits.length + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  const d1 = dv(d);
  const d2 = dv([...d, d1]);
  // Dígitos verificadores trocados de propósito: nunca é um CPF válido de verdade.
  const bad1 = (d1 + 1) % 10;
  const bad2 = (d2 + 3) % 10;
  const all = [...d, bad1, bad2].join("");
  return formatted ? `${all.slice(0, 3)}.${all.slice(3, 6)}.${all.slice(6, 9)}-${all.slice(9)}` : all;
}

const customerCache = new Map<string, Customer>();

export function customerFor(seed: number, id: number): Customer {
  const key = `${seed}:${id}`;
  const hit = customerCache.get(key);
  if (hit) return hit;
  const rng = rngFor(seed, "customer", id);
  const firstname = pick(rng, FIRST);
  const lastname = pick(rng, LAST);
  const place = pickWeighted(rng, CITIES, CITY_WEIGHTS);
  const digits = (n: number): string => Array.from({ length: n }, () => Math.floor(rng() * 10)).join("");
  const c: Customer = {
    id,
    firstname,
    lastname,
    email: `${slug(firstname)}.${slug(lastname)}${id}@${pick(rng, DOMAINS)}`,
    taxvat: fakeCpf(rng, hash32(`${seed}|fmt|${id}`) % 2 === 0),
    phone: `(${place.ddd}) 90${digits(3)}-${digits(4)}`,
    postcode: `${place.cep}${digits(3)}-${digits(3)}`,
    city: place.city,
    region: place.region,
  };
  customerCache.set(key, c);
  return c;
}
