// Shapes returned by the customer-facing RPCs (jsonb payloads).
export type OverviewItem = {
  product_id: string;
  product_name: string;
  unit: string;
  category_name: string;
  category_sort: number;
  tier_id: string | null;
  tier_label: string | null;
  price: number;
  prev_price: number | null;
  published_at: string;
};

export type GroupOverview =
  | { ok: true; group_name: string; published_at: string | null; items: OverviewItem[] }
  | { ok: false; error: string };

export type PriceHistory =
  | { ok: true; points: { published_at: string; price: number }[] }
  | { ok: false; error: string };
