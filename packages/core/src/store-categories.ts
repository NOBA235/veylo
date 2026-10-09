// Product category -> store type mapping (documented in docs/evidence-model.md).
// Weights say how likely a store of that type is to carry products of the category (0..1).
// A weight is relevance, never proof of stock.

export type StoreType =
  | "electronics" | "computer" | "mobile_phone" | "hifi"
  | "hardware" | "doityourself" | "plumbing_supplies" | "bathroom_furnishing"
  | "electrical" | "lighting" | "paint" | "car_parts"
  | "department_store" | "variety_store" | "supermarket" | "convenience" | "houseware" | "stationery";

export const STORE_TYPE_LABEL: Record<StoreType, string> = {
  electronics: "electronics store",
  computer: "computer store",
  mobile_phone: "mobile phone store",
  hifi: "hi-fi / audio store",
  hardware: "hardware store",
  doityourself: "home improvement store",
  plumbing_supplies: "plumbing supply store",
  bathroom_furnishing: "bathroom / sanitary store",
  electrical: "electrical supply store",
  lighting: "lighting store",
  paint: "paint store",
  car_parts: "car parts store",
  department_store: "department store",
  variety_store: "variety store",
  supermarket: "supermarket",
  convenience: "convenience store",
  houseware: "housewares store",
  stationery: "stationery store",
};

/** OpenStreetMap tag selectors. Each entry is an AND-set; any matching set classifies the place. */
export const OSM_SELECTORS: Record<StoreType, Array<Record<string, string>>> = {
  electronics: [{ shop: "electronics" }],
  computer: [{ shop: "computer" }],
  mobile_phone: [{ shop: "mobile_phone" }],
  hifi: [{ shop: "hifi" }],
  hardware: [{ shop: "hardware" }],
  doityourself: [{ shop: "doityourself" }],
  plumbing_supplies: [{ shop: "trade", trade: "plumbing" }],
  bathroom_furnishing: [{ shop: "bathroom_furnishing" }],
  electrical: [{ shop: "electrical" }],
  lighting: [{ shop: "lighting" }],
  paint: [{ shop: "paint" }],
  car_parts: [{ shop: "car_parts" }],
  department_store: [{ shop: "department_store" }],
  variety_store: [{ shop: "variety_store" }],
  supermarket: [{ shop: "supermarket" }],
  convenience: [{ shop: "convenience" }],
  houseware: [{ shop: "houseware" }],
  stationery: [{ shop: "stationery" }],
};

const STORE_TYPES = Object.keys(OSM_SELECTORS) as StoreType[];

export function classifyOsmTags(tags: Record<string, string>): StoreType | null {
  for (const type of STORE_TYPES) {
    for (const set of OSM_SELECTORS[type]) {
      const ok = Object.entries(set).every(([k, v]) => (tags[k] ?? "").split(";").map((x) => x.trim()).includes(v));
      if (ok) return type;
    }
  }
  return null;
}

type Weights = Partial<Record<StoreType, number>>;

const CATEGORY_STORES: Record<string, Weights> = {
  "video adapters": { electronics: 1, computer: 0.9, mobile_phone: 0.6, department_store: 0.4 },
  cables: { electronics: 1, computer: 0.9, mobile_phone: 0.8, department_store: 0.4, variety_store: 0.3 },
  "charging & power": { electronics: 1, mobile_phone: 0.9, computer: 0.7, electrical: 0.6, department_store: 0.4, hardware: 0.3 },
  "computer accessories": { computer: 1, electronics: 0.9, department_store: 0.4, stationery: 0.3 },
  "mobile accessories": { mobile_phone: 1, electronics: 0.8, department_store: 0.3 },
  "audio accessories": { electronics: 1, hifi: 0.8, mobile_phone: 0.5 },
  networking: { computer: 1, electronics: 0.9 },
  "plumbing consumables": { hardware: 1, doityourself: 1, plumbing_supplies: 1, bathroom_furnishing: 0.6 },
  "plumbing fittings": { plumbing_supplies: 1, hardware: 0.9, doityourself: 0.9, bathroom_furnishing: 0.6 },
  "plumbing tools": { hardware: 1, doityourself: 1, plumbing_supplies: 0.9 },
  fasteners: { hardware: 1, doityourself: 1, houseware: 0.3 },
  "adhesives & tapes": { hardware: 1, doityourself: 1, paint: 0.6, stationery: 0.6, department_store: 0.4, variety_store: 0.4 },
  "hand tools": { hardware: 1, doityourself: 1 },
  "electrical supplies": { electrical: 1, hardware: 0.9, doityourself: 0.9, electronics: 0.5 },
  batteries: { electronics: 1, supermarket: 0.6, convenience: 0.6, hardware: 0.6, mobile_phone: 0.5, department_store: 0.5, variety_store: 0.5 },
  lighting: { electrical: 1, lighting: 1, doityourself: 0.9, hardware: 0.8, electronics: 0.5, houseware: 0.5 },
  "household repair": { hardware: 1, doityourself: 1, variety_store: 0.5, paint: 0.5, supermarket: 0.3 },
  "automotive accessories": { car_parts: 1, doityourself: 0.4, supermarket: 0.3 },
};

// Fallback when only a root category is known.
const PARENT_STORES: Record<string, Weights> = {
  electronics: { electronics: 1, computer: 0.7, mobile_phone: 0.6 },
  plumbing: { plumbing_supplies: 1, hardware: 0.9, doityourself: 0.9, bathroom_furnishing: 0.5 },
  hardware: { hardware: 1, doityourself: 1 },
  electrical: { electrical: 1, hardware: 0.8, doityourself: 0.8 },
  household: { hardware: 0.8, doityourself: 0.8, houseware: 0.6, variety_store: 0.5 },
  automotive: { car_parts: 1, doityourself: 0.3 },
};

export function storeWeightsForCategory(category: string, parent?: string | null): Map<StoreType, number> {
  const w = CATEGORY_STORES[category.toLowerCase()] ?? (parent ? PARENT_STORES[parent.toLowerCase()] : undefined)
    ?? PARENT_STORES[category.toLowerCase()];
  return new Map(Object.entries(w ?? {}) as Array<[StoreType, number]>);
}

const HINTS: Array<[RegExp, StoreType]> = [
  [/plumb/, "plumbing_supplies"],
  [/sanitar|bathroom/, "bathroom_furnishing"],
  [/home improvement|diy|do it yourself|doityourself/, "doityourself"],
  [/hardware/, "hardware"],
  [/electronic/, "electronics"],
  [/computer/, "computer"],
  [/mobile|phone/, "mobile_phone"],
  [/hi-?fi|audio/, "hifi"],
  [/electric/, "electrical"],
  [/light/, "lighting"],
  [/paint/, "paint"],
  [/car part|auto/, "car_parts"],
  [/department/, "department_store"],
  [/variety/, "variety_store"],
  [/supermarket|grocery/, "supermarket"],
  [/convenience/, "convenience"],
  [/houseware|home goods/, "houseware"],
  [/stationer/, "stationery"],
];

/** Turn caller-supplied store category hints ("hardware", "sanitary") into store types. */
export function parseStoreHints(hints: readonly string[]): StoreType[] {
  const out: StoreType[] = [];
  for (const raw of hints) {
    const h = raw.toLowerCase();
    const hit = HINTS.find(([re]) => re.test(h));
    if (hit && !out.includes(hit[1])) out.push(hit[1]);
  }
  return out;
}
