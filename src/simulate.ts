import { hash32, rngFor, poisson } from "./prng.ts";
import { demandFactor } from "./calendar.ts";
import { buildCatalog, customerFor, CUSTOMER_POOL, type Product } from "./catalog.ts";
import { clamp, logn, pick, pickWeighted, round1, round2, sampleIndices } from "./util.ts";

export type Row = Record<string, string | number | null>;

/** Uma tabela de saída de um dia simulado. */
export interface DayTable {
  /** Nome lógico (ex.: "ga4_events"). Vira o nome do arquivo. */
  table: string;
  /** Destino no BigQuery: "events_20261122" (fragmentada) ou "ads_Campaign$20261122" (partição). */
  destination: string;
  /** Caminho do schema JSON, relativo a bq/schemas/ (só usado pela carga no BigQuery). */
  schema: string;
  /** Colunas, na ordem. Garante cabeçalho no CSV mesmo com zero linhas. */
  columns: readonly string[];
  rows: Row[];
}

export interface SimOptions {
  /** Multiplica o volume (sessões, gasto). 1 = loja de porte médio (~5 mil sessões/dia). */
  scale?: number;
  /**
   * "Hoje" (YYYY-MM-DD). Só as armadilhas dependem dele: elas valem para os últimos N dias.
   * É a ÚNICA coisa que faz um dia mudar ao longo do tempo; sem armadilhas o dia D é f(seed, D).
   */
  today?: string;
}

// ---- Canais --------------------------------------------------------------------------------

type Kind = "organic" | "brand" | "spend";

interface Channel {
  id: string;
  kind: Kind;
  source: string;
  medium: string;
  campaign: string;
  /** organic: sessões/dia; brand: cliques/dia; spend: gasto (R$)/dia. */
  base: number;
  cpc: number;
  ctr: number;
  cvr: number;
  pView: number;
  campaignId?: number;
  adsType?: "SEARCH" | "PERFORMANCE_MAX";
}

export const CHANNELS: readonly Channel[] = [
  { id: "google_brand", kind: "brand", source: "google", medium: "cpc", campaign: "Search | Marca", base: 520, cpc: 1.1, ctr: 0.32, cvr: 0.045, pView: 0.6, campaignId: 1001, adsType: "SEARCH" },
  { id: "google_generic", kind: "spend", source: "google", medium: "cpc", campaign: "Search | Genérico", base: 1500, cpc: 2.8, ctr: 0.045, cvr: 0.013, pView: 0.5, campaignId: 1002, adsType: "SEARCH" },
  { id: "google_pmax", kind: "spend", source: "google", medium: "cpc", campaign: "PMax | Todos os produtos", base: 1200, cpc: 1.9, ctr: 0.02, cvr: 0.018, pView: 0.55, campaignId: 1003, adsType: "PERFORMANCE_MAX" },
  { id: "organic", kind: "organic", source: "google", medium: "organic", campaign: "(organic)", base: 2400, cpc: 0, ctr: 0, cvr: 0.015, pView: 0.5, },
  { id: "direct", kind: "organic", source: "(direct)", medium: "(none)", campaign: "(direct)", base: 700, cpc: 0, ctr: 0, cvr: 0.022, pView: 0.45 },
  { id: "email", kind: "organic", source: "newsletter", medium: "email", campaign: "Newsletter semanal", base: 350, cpc: 0, ctr: 0, cvr: 0.03, pView: 0.6 },
];

/** Fração dos cliques pagos que chega como sessão no GA4 (perda de rastreio realista). */
const CLICK_TO_SESSION = 0.94;
/** Fração das conversões que o Google Ads declara, sobre as reais. */
const ADS_CAPTURE = 0.88;

/** Nível das armadilhas. A1: o `purchase` do GA4 sai duplicado nos últimos N dias. */
export const TRAPS = { A1_DUPLICATE_PURCHASE_DAYS: 12 } as const;

// ---- Tempo ---------------------------------------------------------------------------------

const MS_DAY = 86_400_000;
const BRT_OFFSET_MS = 3 * 3_600_000; // dia comercial em Brasília (UTC-3)
const HOUR_WEIGHTS = [1, 0.6, 0.4, 0.3, 0.3, 0.5, 1, 2, 3.5, 4.5, 5, 5.2, 5, 5.2, 5.4, 5.2, 5, 5.2, 5.8, 6.8, 7.6, 7.4, 5, 2.5];
const HOURS = HOUR_WEIGHTS.map((_, i) => i);
const ANCHOR_MS = Date.UTC(2025, 0, 1);
const EPOCH_2020_MS = Date.UTC(2020, 0, 1);

const dayMs = (date: string): number => Date.parse(`${date}T00:00:00Z`);

// ---- Colunas -------------------------------------------------------------------------------

export const GA4_COLUMNS = [
  "event_date", "event_timestamp", "event_name", "user_pseudo_id", "ga_session_id",
  "traffic_source_source", "traffic_source_medium", "traffic_source_campaign",
  "device_category", "item_id", "item_name", "value", "currency", "transaction_id",
] as const;
export const ORDER_COLUMNS = [
  "entity_id", "increment_id", "created_at", "status", "store_id", "customer_id",
  "customer_email", "customer_firstname", "customer_lastname", "customer_taxvat",
  "shipping_telephone", "shipping_postcode", "shipping_city", "shipping_region",
  "total_item_count", "subtotal", "discount_amount", "shipping_amount", "grand_total",
  "coupon_code", "payment_method",
] as const;
export const ITEM_COLUMNS = ["item_id", "order_id", "sku", "name", "qty_ordered", "price", "row_total", "base_cost"] as const;
export const CREDITMEMO_COLUMNS = ["entity_id", "order_id", "order_increment_id", "created_at", "grand_total"] as const;
export const ADS_COLUMNS = ["date", "campaign_id", "campaign_name", "campaign_type", "impressions", "clicks", "cost", "conversions", "conversions_value"] as const;
export const TRUTH_COLUMNS = ["date", "channel", "sessions", "orders", "revenue"] as const;
export const PRODUCT_COLUMNS = ["sku", "name", "category", "price", "cost"] as const;

// ---- Simulação -----------------------------------------------------------------------------

interface Session {
  channel: Channel;
  startMs: number;
  device: string;
  userId: string;
  sessionId: number;
  buyer: boolean;
  customerId?: number;
  purchaseMs?: number;
  orderIdx?: number;
}

interface BuiltOrder {
  entityId: number;
  incrementId: string;
  createdMs: number;
  status: "complete" | "canceled" | "closed";
  session: Session;
  items: { product: Product; qty: number }[];
  subtotal: number;
  discount: number;
  shipping: number;
  grandTotal: number;
  coupon: string | null;
  payment: string;
}

function daysBetween(from: string, to: string): number {
  return Math.round((dayMs(to) - dayMs(from)) / MS_DAY);
}

function sessionStartMs(date: string, hour: number, rng: () => number): number {
  const minute = Math.floor(rng() * 60);
  const sec = Math.floor(rng() * 60);
  let offset = ((hour * 60 + minute) * 60 + sec) * 1000;
  offset = Math.min(offset, (23 * 60 + 40) * 60_000); // deixa folga para o pedido fechar no mesmo dia
  return dayMs(date) + offset + BRT_OFFSET_MS;
}

/**
 * Gera todas as tabelas de um dia. Determinística: o mesmo (seed, date, opções) dá sempre o mesmo resultado.
 * Modelo e armadilhas em docs/ARQUITETURA.md e docs/CENARIOS.md.
 */
export function simulateDay(seed: number, date: string, opts: SimOptions = {}): DayTable[] {
  const scale = opts.scale ?? 1;
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const daysAgo = daysBetween(date, today);
  const catalog = buildCatalog(seed);
  const productWeights = catalog.map((p) => p.weight);

  const df = demandFactor(date);
  const idx = (dayMs(date) - ANCHOR_MS) / MS_DAY;
  const trend = Math.max(0.5, 1 + 0.0004 * idx);
  const ymd = date.replaceAll("-", "");

  // 1. Tráfego por canal ---------------------------------------------------------------------
  const sessions: Session[] = [];
  const adsRows: Row[] = [];
  const channelStats = new Map<string, { sessions: number; orders: number; revenue: number; adsConv: number; adsValue: number }>();
  const spendByChannel = new Map<string, { spend: number; clicks: number; impressions: number }>();

  for (const ch of CHANNELS) {
    const rng = rngFor(seed, date, "traffic", ch.id);
    let sessionCount: number;
    if (ch.kind === "organic") {
      sessionCount = poisson(rng, ch.base * scale * df * trend * logn(rng, 0.06));
    } else {
      let clicks: number;
      let cpc: number;
      let spend: number;
      if (ch.kind === "brand") {
        // Busca de marca segue a demanda, não o orçamento.
        clicks = poisson(rng, ch.base * scale * Math.pow(df, 1.2) * trend * logn(rng, 0.05));
        cpc = ch.cpc * logn(rng, 0.05);
        spend = clicks * cpc;
      } else {
        spend = ch.base * scale * (1 + 0.6 * (df - 1)) * Math.sqrt(trend) * logn(rng, 0.08);
        cpc = ch.cpc * (1 + 0.25 * (df - 1)) * logn(rng, 0.07);
        clicks = Math.max(0, Math.round(spend / cpc));
      }
      const impressions = Math.round((clicks / ch.ctr) * logn(rng, 0.05));
      spendByChannel.set(ch.id, { spend: round2(spend), clicks, impressions });
      sessionCount = Math.round(clicks * CLICK_TO_SESSION);
    }

    const cvr = ch.cvr * (1 + 0.25 * (df - 1));
    const orderCount = Math.min(sessionCount, poisson(rng, sessionCount * cvr));
    const buyerSet = new Set(sampleIndices(rng, sessionCount, orderCount));

    for (let i = 0; i < sessionCount; i++) {
      const srng = rngFor(seed, date, "session", ch.id, i);
      const hour = pickWeighted(srng, HOURS, HOUR_WEIGHTS);
      const startMs = sessionStartMs(date, hour, srng);
      const buyer = buyerSet.has(i);
      const device = pickWeighted(srng, ["mobile", "desktop", "tablet"], [0.62, 0.32, 0.06]);
      let userId: string;
      let customerId: number | undefined;
      if (buyer) {
        // Clientes recorrentes: quanto menor o id, mais compra (distribuição enviesada).
        customerId = 1 + Math.floor(CUSTOMER_POOL * Math.pow(srng(), 2.2));
        userId = `${seedHash(seed, "c", customerId)}.${1_600_000_000 + (seedHash(seed, "cc", customerId) % 90_000_000)}`;
      } else {
        userId = `${seedHash(seed, `${date}|${ch.id}`, i)}.${1_600_000_000 + (seedHash(seed, `${date}|t|${ch.id}`, i) % 90_000_000)}`;
      }
      sessions.push({
        channel: ch,
        startMs,
        device,
        userId,
        sessionId: Math.floor(startMs / 1000),
        buyer,
        customerId,
        purchaseMs: buyer ? startMs + (180 + Math.floor(srng() * 720)) * 1000 : undefined,
      });
    }
    channelStats.set(ch.id, { sessions: sessionCount, orders: 0, revenue: 0, adsConv: 0, adsValue: 0 });
  }

  // 2. Pedidos (numeração sequencial por horário de compra) ----------------------------------
  const buyers = sessions.filter((s) => s.buyer).sort((a, b) => a.purchaseMs! - b.purchaseMs!);
  const dayNumber = Math.round((dayMs(date) - EPOCH_2020_MS) / MS_DAY);
  const orders: BuiltOrder[] = buyers.map((s, n) => {
    s.orderIdx = n + 1;
    const rng = rngFor(seed, date, "order", n + 1);
    const entityId = dayNumber * 10_000 + (n + 1);

    const nItems = clamp(1 + poisson(rng, 0.55), 1, 5);
    const items: { product: Product; qty: number }[] = [];
    for (let k = 0; k < nItems; k++) {
      const product = pickWeighted(rng, catalog, productWeights);
      const existing = items.find((it) => it.product.sku === product.sku);
      const qty = rng() < 0.85 ? 1 : 2;
      if (existing) existing.qty += qty;
      else items.push({ product, qty });
    }
    const subtotal = round2(items.reduce((acc, it) => acc + it.product.price * it.qty, 0));

    let coupon: string | null = null;
    let discount = 0;
    if (rng() < clamp(0.18 + 0.2 * (df - 1), 0, 0.6)) {
      const options: [string, number][] = [["BEMVINDO10", 0.1], ["PRIMEIRACOMPRA15", 0.15]];
      if (df > 1.8) options.push(["BLACK20", 0.2]);
      const [code, pct] = pick(rng, options);
      coupon = code;
      discount = round2(subtotal * pct);
    }
    const shipping = subtotal >= 299 ? 0 : pick(rng, [14.9, 19.9, 24.9, 29.9]);
    const u = rng();
    return {
      entityId,
      incrementId: String(entityId).padStart(9, "0"),
      createdMs: s.purchaseMs!,
      status: u < 0.04 ? "canceled" : u < 0.07 ? "closed" : "complete",
      session: s,
      items,
      subtotal,
      discount,
      shipping,
      grandTotal: round2(subtotal - discount + shipping),
      coupon,
      payment: pickWeighted(rng, ["pix", "credit_card", "boleto"], [0.38, 0.5, 0.12]),
    };
  });

  for (const o of orders) {
    const st = channelStats.get(o.session.channel.id)!;
    st.orders++;
    st.revenue = round2(st.revenue + o.grandTotal);
  }

  // 3. Linhas do Magento ---------------------------------------------------------------------
  const orderRows: Row[] = [];
  const itemRows: Row[] = [];
  const memoRows: Row[] = [];
  for (const o of orders) {
    const c = customerFor(seed, o.session.customerId!);
    orderRows.push({
      entity_id: o.entityId,
      increment_id: o.incrementId,
      created_at: new Date(o.createdMs).toISOString(),
      status: o.status,
      store_id: 1,
      customer_id: c.id,
      customer_email: c.email,
      customer_firstname: c.firstname,
      customer_lastname: c.lastname,
      customer_taxvat: c.taxvat,
      shipping_telephone: c.phone,
      shipping_postcode: c.postcode,
      shipping_city: c.city,
      shipping_region: c.region,
      total_item_count: o.items.length,
      subtotal: o.subtotal,
      discount_amount: o.discount,
      shipping_amount: o.shipping,
      grand_total: o.grandTotal,
      coupon_code: o.coupon,
      payment_method: o.payment,
    });
    o.items.forEach((it, k) => {
      itemRows.push({
        item_id: o.entityId * 10 + k + 1,
        order_id: o.entityId,
        sku: it.product.sku,
        name: it.product.name,
        qty_ordered: it.qty,
        price: it.product.price,
        row_total: round2(it.product.price * it.qty),
        base_cost: it.product.cost,
      });
    });
    if (o.status === "closed") {
      // Devolução simplificada: estorno no mesmo dia, 2h depois do pedido.
      memoRows.push({
        entity_id: o.entityId,
        order_id: o.entityId,
        order_increment_id: o.incrementId,
        created_at: new Date(o.createdMs + 2 * 3_600_000).toISOString(),
        grand_total: o.grandTotal,
      });
    }
  }

  // 4. Eventos do GA4 ------------------------------------------------------------------------
  const duplicatePurchases = daysAgo >= 1 && daysAgo <= TRAPS.A1_DUPLICATE_PURCHASE_DAYS;
  const orderBySession = new Map<Session, BuiltOrder>(orders.map((o) => [o.session, o]));
  const events: Row[] = [];
  const emit = (s: Session, name: string, ms: number, extra: Partial<Record<(typeof GA4_COLUMNS)[number], string | number | null>> = {}): void => {
    events.push({
      event_date: ymd,
      event_timestamp: ms * 1000,
      event_name: name,
      user_pseudo_id: s.userId,
      ga_session_id: s.sessionId,
      traffic_source_source: s.channel.source,
      traffic_source_medium: s.channel.medium,
      traffic_source_campaign: s.channel.campaign,
      device_category: s.device,
      item_id: null,
      item_name: null,
      value: null,
      currency: null,
      transaction_id: null,
      ...extra,
    });
  };

  for (let i = 0; i < sessions.length; i++) {
    const s = sessions[i]!;
    const rng = rngFor(seed, date, "events", s.userId, s.sessionId);
    const order = orderBySession.get(s);
    emit(s, "session_start", s.startMs);

    const viewed = s.buyer || rng() < s.channel.pView;
    if (!viewed) continue;
    const product = order ? order.items[0]!.product : pickWeighted(rng, catalog, productWeights);
    const itemInfo = { item_id: product.sku, item_name: product.name, value: product.price, currency: "BRL" };
    let t = s.startMs + (20 + Math.floor(rng() * 100)) * 1000;
    emit(s, "view_item", t, itemInfo);

    const carted = s.buyer || rng() < 0.22;
    if (!carted) continue;
    t += (15 + Math.floor(rng() * 90)) * 1000;
    emit(s, "add_to_cart", t, itemInfo);

    const checkout = s.buyer || rng() < 0.55;
    if (!checkout) continue;
    t += (30 + Math.floor(rng() * 120)) * 1000;
    emit(s, "begin_checkout", t, itemInfo);

    if (order) {
      const purchase = { value: order.grandTotal, currency: "BRL", transaction_id: order.incrementId };
      emit(s, "purchase", order.createdMs, purchase);
      // Armadilha A1: o disparo duplo do `purchase` nos últimos N dias.
      if (duplicatePurchases) emit(s, "purchase", order.createdMs + 1000 + Math.floor(rng() * 2000), purchase);
    }
  }
  events.sort((a, b) => (a.event_timestamp as number) - (b.event_timestamp as number));

  // 5. Google Ads + verdade conhecida --------------------------------------------------------
  const truthRows: Row[] = [];
  for (const ch of CHANNELS) {
    const st = channelStats.get(ch.id)!;
    truthRows.push({ date, channel: ch.id, sessions: st.sessions, orders: st.orders, revenue: st.revenue });
    const sp = spendByChannel.get(ch.id);
    if (!sp) continue;
    const rng = rngFor(seed, date, "ads", ch.id);
    const f = Math.min(1, ADS_CAPTURE * logn(rng, 0.08));
    adsRows.push({
      date,
      campaign_id: ch.campaignId!,
      campaign_name: ch.campaign,
      campaign_type: ch.adsType!,
      impressions: sp.impressions,
      clicks: sp.clicks,
      cost: sp.spend,
      conversions: round1(st.orders * f),
      conversions_value: round2(st.revenue * f),
    });
  }

  return [
    { table: "ga4_events", destination: `events_${ymd}`, schema: "ga4_events.json", columns: GA4_COLUMNS, rows: events },
    { table: "magento_orders", destination: `magento_orders$${ymd}`, schema: "magento_orders.json", columns: ORDER_COLUMNS, rows: orderRows },
    { table: "magento_order_items", destination: `magento_order_items$${ymd}`, schema: "magento_order_items.json", columns: ITEM_COLUMNS, rows: itemRows },
    { table: "magento_creditmemos", destination: `magento_creditmemos$${ymd}`, schema: "magento_creditmemos.json", columns: CREDITMEMO_COLUMNS, rows: memoRows },
    { table: "ads_campaign_stats", destination: `ads_campaign_stats$${ymd}`, schema: "ads_campaign_stats.json", columns: ADS_COLUMNS, rows: adsRows },
    { table: "truth_daily_channel", destination: `truth_daily_channel$${ymd}`, schema: "truth_daily_channel.json", columns: TRUTH_COLUMNS, rows: truthRows },
  ];
}

/** Catálogo estático (não muda por dia). */
export function catalogTable(seed: number): DayTable {
  return {
    table: "magento_products",
    destination: "magento_products",
    schema: "magento_products.json",
    columns: PRODUCT_COLUMNS,
    rows: buildCatalog(seed).map((p) => ({ sku: p.sku, name: p.name, category: p.category, price: p.price, cost: p.cost })),
  };
}

function seedHash(seed: number, tag: string, n: number): number {
  return hash32(`${seed}|${tag}|${n}`);
}
