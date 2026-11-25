import type { DayTable } from "./simulate.ts";

type BqType = "STRING" | "INTEGER" | "FLOAT" | "TIMESTAMP" | "DATE";

/** Tipos explícitos por coluna. Inferir de uma linha de exemplo erra (ex.: frete 0 vira INTEGER). */
const TYPES: Record<string, Record<string, BqType>> = {
  ga4_events: {
    event_date: "STRING", event_timestamp: "INTEGER", event_name: "STRING", user_pseudo_id: "STRING",
    ga_session_id: "INTEGER", traffic_source_source: "STRING", traffic_source_medium: "STRING",
    traffic_source_campaign: "STRING", device_category: "STRING", item_id: "STRING", item_name: "STRING",
    value: "FLOAT", currency: "STRING", transaction_id: "STRING",
  },
  magento_orders: {
    entity_id: "INTEGER", increment_id: "STRING", created_at: "TIMESTAMP", status: "STRING", store_id: "INTEGER",
    customer_id: "INTEGER", customer_email: "STRING", customer_firstname: "STRING", customer_lastname: "STRING",
    customer_taxvat: "STRING", shipping_telephone: "STRING", shipping_postcode: "STRING", shipping_city: "STRING",
    shipping_region: "STRING", total_item_count: "INTEGER", subtotal: "FLOAT", discount_amount: "FLOAT",
    shipping_amount: "FLOAT", grand_total: "FLOAT", coupon_code: "STRING", payment_method: "STRING",
  },
  magento_order_items: {
    item_id: "INTEGER", order_id: "INTEGER", sku: "STRING", product_name: "STRING", qty_ordered: "INTEGER",
    price: "FLOAT", row_total: "FLOAT", base_cost: "FLOAT",
  },
  magento_creditmemos: {
    entity_id: "INTEGER", order_id: "INTEGER", order_increment_id: "STRING", created_at: "TIMESTAMP", grand_total: "FLOAT",
  },
  ads_campaign_stats: {
    date: "DATE", campaign_id: "INTEGER", campaign_name: "STRING", campaign_type: "STRING", impressions: "INTEGER",
    clicks: "INTEGER", cost: "FLOAT", conversions: "FLOAT", conversions_value: "FLOAT",
  },
  truth_daily_channel: {
    date: "DATE", channel: "STRING", sessions: "INTEGER", orders: "INTEGER", revenue: "FLOAT",
  },
  magento_products: { sku: "STRING", product_name: "STRING", category: "STRING", price: "FLOAT", cost: "FLOAT" },
};

export interface BqField { name: string; type: BqType; mode: "NULLABLE" }

/** Schema no formato do `bq load` (lista de campos), na ordem das colunas da tabela. */
export function schemaFor(t: Pick<DayTable, "table" | "columns">): BqField[] {
  const types = TYPES[t.table];
  if (!types) throw new Error(`Sem tipos declarados para a tabela "${t.table}" (src/schemas.ts)`);
  return t.columns.map((name) => {
    const type = types[name];
    if (!type) throw new Error(`Sem tipo para ${t.table}.${name} (src/schemas.ts)`);
    return { name, type, mode: "NULLABLE" };
  });
}
